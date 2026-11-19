defmodule MusicPlatformApiWeb.StreamController do
  use MusicPlatformApiWeb, :controller
  alias MusicPlatformApi.{Auth, Music, Repo}
  alias MusicPlatformApi.Music.Track
  alias MusicPlatformApi.ID3

  defp get_current_user(conn) do
    token =
      case get_req_header(conn, "authorization") do
        ["Bearer " <> t] -> t
        _ -> conn.params["token"]
      end

    if is_binary(token) and token != "" do
      Auth.get_user_from_token(token)
    else
      nil
    end
  end

  defp can_access_track?(track, user) do
    cond do
      track.status == "approved" -> true
      is_nil(user) -> false
      user.role in ["owner", "admin", "moderator"] -> true
      track.creator_id == user.id -> true
      true -> false
    end
  end

  # Потоковое воспроизведение аудиофайла
  def stream(conn, %{"id" => id}) do
    with valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Track{} = track <- Repo.get(Track, valid_id),
         true <- can_access_track?(track, get_current_user(conn)),
         true <- is_binary(track.file_path) and File.exists?(track.file_path) do
      if track.status == "approved" and initial_stream_request?(conn) do
        Task.start(fn ->
          Ecto.Adapters.SQL.query(Repo, "UPDATE tracks SET plays_count = plays_count + 1 WHERE id = $1", [track.id])
          Ecto.Adapters.SQL.query(Repo, "UPDATE artists SET plays_count = plays_count + 1 WHERE id = $1", [track.artist_id])
        end)
      end

      file_size = File.stat!(track.file_path).size
      send_audio_stream(conn, track.file_path, file_size)
    else
      false ->
        conn |> put_status(:not_found) |> json(%{error: "Трек или файл не найден"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})
    end
  end

  # Проверка на первичный запрос аудиопотока
  defp initial_stream_request?(conn) do
    case get_req_header(conn, "range") do
      ["bytes=0-" <> _] -> true
      [] -> true
      _ -> false
    end
  end

  # Передача аудиопотока с поддержкой Range заголовка
  defp send_audio_stream(conn, path, file_size) do
    case get_req_header(conn, "range") do
      ["bytes=" <> range_spec] ->
        parsed_range =
          case String.split(range_spec, "-") do
            [s, ""] ->
              with {start_b, ""} <- Integer.parse(s) do
                {:ok, start_b, file_size - 1}
              end

            [s, e] ->
              with {start_b, ""} <- Integer.parse(s),
                   {end_b, ""} <- Integer.parse(e) do
                {:ok, start_b, min(end_b, file_size - 1)}
              end

            _ ->
              :invalid
          end

        case parsed_range do
          {:ok, start_byte, end_byte} when start_byte >= 0 and start_byte <= end_byte ->
            length = end_byte - start_byte + 1

            {:ok, file} = :file.open(path, [:read, :binary])
            {:ok, data} = :file.pread(file, start_byte, length)
            :file.close(file)

            conn
            |> put_resp_header("content-range", "bytes #{start_byte}-#{end_byte}/#{file_size}")
            |> put_resp_header("accept-ranges", "bytes")
            |> put_resp_header("content-type", "audio/mpeg")
            |> put_status(206)
            |> send_resp(206, data)

          _ ->
            conn
            |> put_resp_header("content-range", "bytes */#{file_size}")
            |> send_resp(416, "")
        end

      _ ->
        conn
        |> put_resp_header("content-type", "audio/mpeg")
        |> put_resp_header("content-length", to_string(file_size))
        |> put_resp_header("accept-ranges", "bytes")
        |> send_file(200, path)
    end
  end

  # Скачивание трека с внедрением ID3 тегов
  def download(conn, %{"id" => id}) do
    with valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Track{} = track <- Repo.get(Track, valid_id) |> Repo.preload([:artist, :album]),
         true <- can_access_track?(track, get_current_user(conn)),
         true <- is_binary(track.file_path) and File.exists?(track.file_path) do
      artist_name = if track.artist, do: track.artist.name, else: "Неизвестный исполнитель"
      track_title = track.title || "Без названия"
      album_title = if track.album, do: track.album.title, else: ""

      pos_str = to_string(track.position || 1)
      year_str = if track.release_year, do: to_string(track.release_year), else: ""

      {cover_bytes, cover_mime} = load_track_cover(track)
      original_bytes = File.read!(track.file_path)

      tagged_audio =
        ID3.inject_tags(original_bytes, %{
          title: track_title,
          artist: artist_name,
          album: album_title,
          track: pos_str,
          year: year_str,
          cover: cover_bytes,
          cover_mime: cover_mime
        })

      clean_name = String.replace("#{artist_name} – #{track_title}", ~r/[\\\/:\*\?"<>\|]/u, "")
      encoded_filename = URI.encode("#{clean_name}.mp3")

      conn
      |> put_resp_header(
        "content-disposition",
        "attachment; filename=\"#{encoded_filename}\"; filename*=UTF-8''#{encoded_filename}"
      )
      |> put_resp_header("content-type", "audio/mpeg")
      |> put_resp_header("content-length", to_string(byte_size(tagged_audio)))
      |> send_resp(200, tagged_audio)
    else
      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Файл не найден"})
    end
  end

  # Поиск и чтение обложки для трека
  defp load_track_cover(track) do
    cover_candidate =
      cond do
        is_binary(track.cover) and String.trim(track.cover) != "" ->
          track.cover

        is_map(track.album) and is_binary(track.album.cover) and String.trim(track.album.cover) != "" ->
          track.album.cover

        is_map(track.artist) and is_binary(track.artist.avatar) and String.trim(track.artist.avatar) != "" ->
          track.artist.avatar

        true ->
          nil
      end

    case read_cover_file(cover_candidate) do
      {:ok, bytes, mime} ->
        {bytes, mime}

      :error ->
        case read_default_cover() do
          {:ok, bytes, mime} -> {bytes, mime}
          :error -> {nil, nil}
        end
    end
  end

  # Чтение файла обложки по пути
  defp read_cover_file(path_or_url) when is_binary(path_or_url) and path_or_url != "" do
    case resolve_disk_path(path_or_url) do
      {:ok, full_path} ->
        case File.read(full_path) do
          {:ok, binary} ->
            mime = detect_mime(full_path, binary)
            {:ok, binary, mime}

          _ ->
            :error
        end

      _ ->
        :error
    end
  end

  defp read_cover_file(_), do: :error

  # Чтение запасной обложки
  defp read_default_cover do
    default_candidates =
      [
        Path.expand("priv/static/uploads/covers/default_cover.jpg"),
        Path.expand("priv/static/default_cover.jpg"),
        Path.wildcard("priv/static/uploads/covers/*.jpg") |> List.first()
      ]
      |> Enum.reject(&is_nil/1)

    case Enum.find(default_candidates, &File.exists?/1) do
      nil ->
        :error

      path ->
        {:ok, binary} = File.read(path)
        {:ok, binary, "image/jpeg"}
    end
  end

  # Разрешение абсолютного пути к файлу на диске строго в пределах uploads
  defp resolve_disk_path(url_or_path) when is_binary(url_or_path) and url_or_path != "" do
    uploads_root = Path.expand("priv/static/uploads")
    clean_path = String.replace_leading(url_or_path, "/", "")

    candidates =
      [
        Path.expand(url_or_path),
        Path.expand(Path.join("priv/static", clean_path))
      ]
      |> Enum.filter(fn p ->
        String.starts_with?(p, uploads_root <> "/") or String.starts_with?(p, uploads_root <> "\\")
      end)

    case Enum.find(candidates, &File.exists?/1) do
      nil -> :error
      path -> {:ok, path}
    end
  end

  defp resolve_disk_path(_), do: :error

  # Определение MIME-типа изображения
  defp detect_mime(path, binary) do
    ext = Path.extname(path) |> String.downcase()

    cond do
      ext in [".jpg", ".jpeg"] -> "image/jpeg"
      ext == ".png" -> "image/png"
      match?(<<0xFF, 0xD8, _::binary>>, binary) -> "image/jpeg"
      match?(<<0x89, 0x50, 0x4E, 0x47, _::binary>>, binary) -> "image/png"
      true -> "image/jpeg"
    end
  end
end
