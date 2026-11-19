defmodule MusicPlatformApiWeb.MusicController do
  use MusicPlatformApiWeb, :controller
  import Ecto.Query
  alias MusicPlatformApi.{Auth, Music, Repo}
  alias MusicPlatformApi.Music.{Artist, Track, Album, Playlist}

  defp authenticate_user(conn) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         user when not is_nil(user) <- Auth.get_user_from_token(token) do
      {:ok, user}
    else
      _ -> {:error, :unauthorized}
    end
  end

  defp optional_user(conn) do
    case authenticate_user(conn) do
      {:ok, user} -> user
      _ -> nil
    end
  end

  defp staff?(user) do
    not is_nil(user) and user.role in ["owner", "admin", "moderator"]
  end

  # Показ страницы артиста
  def get_artist(conn, %{"id" => id}) do
    case Music.get_artist_page(id) do
      {:ok, data} -> json(conn, %{success: true, data: data})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "Артист не найден"})
    end
  end

  # Список артистов с поддержкой фильтрации по жанру и поиску
  def list_artists(conn, params) do
    genre_param = Map.get(params, "genre")
    search_param = Map.get(params, "search")

    query = from a in Artist, where: a.status == "approved"

    query =
      if genre_param && String.trim(genre_param) != "" do
        target = String.trim(genre_param)
        from a in query, where: ^target in a.genres or ilike(a.genre, ^"%#{target}%")
      else
        query
      end

    query =
      if search_param && String.trim(search_param) != "" do
        search_term = "%#{String.trim(search_param)}%"
        from a in query, where: ilike(a.name, ^search_term)
      else
        query
      end

    query = from a in query, order_by: [desc: a.plays_count, desc: a.inserted_at]
    artists = Repo.all(query)
    json(conn, %{success: true, data: artists})
  end

  # Создание профиля артиста с парсингом жанров
  def create_artist(conn, params) do
    with {:ok, user} <- authenticate_user(conn),
         {:ok, params} <- maybe_save_file(params, "avatar", "avatars") do
      params =
        case Map.get(params, "genres") do
          list when is_list(list) ->
            params

          str when is_binary(str) ->
            parsed =
              str
              |> String.split(",")
              |> Enum.map(&String.trim/1)
              |> Enum.reject(&(&1 == ""))

            Map.put(params, "genres", parsed)

          _ ->
            if genre_str = Map.get(params, "genre") do
              parsed =
                genre_str
                |> String.split(",")
                |> Enum.map(&String.trim/1)
                |> Enum.reject(&(&1 == ""))

              Map.put(params, "genres", parsed)
            else
              params
            end
        end

      case Music.create_artist(params, user.id) do
        {:ok, artist} ->
          conn
          |> put_status(:created)
          |> json(%{success: true, artist: artist})

        {:error, changeset} ->
          Music.delete_file(params["avatar"])
          errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)

          conn
          |> put_status(:bad_request)
          |> json(%{error: "Ошибка создания артиста", details: errors})
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      {:error, :invalid_file_type} ->
        conn |> put_status(:bad_request) |> json(%{error: "Недопустимый формат изображения"})

      {:error, :file_too_large} ->
        conn |> put_status(:bad_request) |> json(%{error: "Файл превышает допустимый размер"})

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки файла"})
    end
  end

  # Обновление артиста
  def update_artist(conn, %{"id" => id} = params) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Artist{} = artist <- Repo.get(Artist, valid_id) do
      if artist.creator_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на изменение"})
      else
        params =
          case Map.get(params, "genres") do
            list when is_list(list) ->
              params

            str when is_binary(str) ->
              parsed =
                str
                |> String.split(",")
                |> Enum.map(&String.trim/1)
                |> Enum.reject(&(&1 == ""))

              Map.put(params, "genres", parsed)

            _ ->
              params
          end

        case artist |> Artist.changeset(params) |> Repo.update() do
          {:ok, updated} ->
            json(conn, %{success: true, artist: updated})

          {:error, changeset} ->
            errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка обновления артиста", details: errors})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Артист не найден"})
    end
  end

  # Создание сингла
  def create_single(conn, params) do
    with {:ok, user} <- authenticate_user(conn),
         {:ok, params} <- maybe_save_file(params, "cover", "covers"),
         {:ok, params} <- maybe_save_audio(params, "audio") do
      case Music.create_single(params, user.id) do
        {:ok, track} ->
          raw_collabs = Map.get(params, "collaborator_ids") || Map.get(params, "collaborator_ids[]")

          if raw_collabs do
            ids =
              (if is_list(raw_collabs), do: raw_collabs, else: [raw_collabs])
              |> Enum.map(&Music.parse_nullable_id/1)
              |> Enum.reject(&is_nil/1)

            artists = Repo.all(from a in Artist, where: a.id in ^ids)

            track
            |> Repo.preload(:collaborators)
            |> Ecto.Changeset.change()
            |> Ecto.Changeset.put_assoc(:collaborators, artists)
            |> Repo.update!()
          end

          conn |> put_status(:created) |> json(%{success: true, track: track})

        {:error, changeset} ->
          Music.delete_file(params["cover"])
          Music.delete_file(params["file_path"])
          errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
          conn |> put_status(:bad_request) |> json(%{error: "Ошибка создания трека", details: errors})
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      {:error, :invalid_file_type} ->
        conn |> put_status(:bad_request) |> json(%{error: "Недопустимый формат файла"})

      {:error, :file_too_large} ->
        conn |> put_status(:bad_request) |> json(%{error: "Размер файла превышает допустимый лимит"})

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки файлов"})
    end
  end

  # Создание альбома
  def create_album(conn, params) do
    with {:ok, user} <- authenticate_user(conn),
         {:ok, params} <- maybe_save_file(params, "cover", "covers") do
      raw_tracks = Map.get(params, "tracks", %{})

      tracks_result =
        Enum.reduce_while(raw_tracks, {:ok, []}, fn {_idx, track}, {:ok, acc} ->
          with {:ok, t1} <- maybe_save_file(track, "cover", "covers"),
               {:ok, t2} <- maybe_save_audio(t1, "audio") do
            {:cont, {:ok, [t2 | acc]}}
          else
            err -> {:halt, err}
          end
        end)

      case tracks_result do
        {:ok, reversed_tracks} ->
          album_params = Map.put(params, "tracks", Enum.reverse(reversed_tracks))

          case Music.create_album_with_tracks(album_params, user.id) do
            {:ok, album} ->
              conn |> put_status(:created) |> json(%{success: true, album: album})

            {:error, changeset} ->
              Music.delete_file(params["cover"])
              errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
              conn |> put_status(:bad_request) |> json(%{error: "Ошибка создания альбома", details: errors})
          end

        {:error, :invalid_file_type} ->
          Music.delete_file(params["cover"])
          conn |> put_status(:bad_request) |> json(%{error: "Один из файлов имеет недопустимый формат"})

        {:error, :file_too_large} ->
          Music.delete_file(params["cover"])
          conn |> put_status(:bad_request) |> json(%{error: "Один из файлов превышает допустимый размер"})

        {:error, _} ->
          Music.delete_file(params["cover"])
          conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки файлов альбома"})
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      {:error, :invalid_file_type} ->
        conn |> put_status(:bad_request) |> json(%{error: "Недопустимый формат обложки"})

      {:error, :file_too_large} ->
        conn |> put_status(:bad_request) |> json(%{error: "Размер обложки превышает допустимый лимит"})

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки обложки"})
    end
  end

  # Удаление трека (только создатель или персонал)
  def delete_track(conn, %{"id" => id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Track{} = track <- Repo.get(Track, valid_id) do
      if track.creator_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на удаление трека"})
      else
        case Repo.delete(track) do
          {:ok, deleted_track} ->
            Music.delete_file(deleted_track.file_path)
            Music.delete_file(deleted_track.cover)
            json(conn, %{success: true, message: "Трек удален"})

          {:error, _changeset} ->
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка удаления трека"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})
    end
  end

  # Удаление альбома (только создатель или персонал)
  def delete_album(conn, %{"id" => id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Album{} = album <- Repo.get(Album, valid_id) |> Repo.preload(:tracks) do
      if album.creator_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на удаление альбома"})
      else
        case Repo.delete(album) do
          {:ok, deleted_album} ->
            Music.delete_file(deleted_album.cover)

            Enum.each(deleted_album.tracks, fn track ->
              Music.delete_file(track.file_path)
              Music.delete_file(track.cover)
            end)

            json(conn, %{success: true, message: "Альбом и треки удалены"})

          {:error, _} ->
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка удаления альбома"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Альбом не найден"})
    end
  end

  # Удаление артиста (только создатель или персонал)
  def delete_artist(conn, %{"id" => id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Artist{} = artist <- Repo.get(Artist, valid_id) |> Repo.preload([:albums, :tracks]) do
      if artist.creator_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на удаление артиста"})
      else
        case Repo.delete(artist) do
          {:ok, deleted_artist} ->
            Music.delete_file(deleted_artist.avatar)

            Enum.each(deleted_artist.albums, fn album ->
              Music.delete_file(album.cover)
            end)

            Enum.each(deleted_artist.tracks, fn track ->
              Music.delete_file(track.file_path)
              Music.delete_file(track.cover)
            end)

            json(conn, %{success: true, message: "Артист удален"})

          {:error, _} ->
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка удаления артиста"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Артист не найден"})
    end
  end

  defp maybe_save_file(params, key, folder) do
    case params[key] do
      %Plug.Upload{} = upload ->
        case Music.save_upload(upload, folder) do
          {:ok, url, _} -> {:ok, Map.put(params, key, url)}
          error -> error
        end

      _ ->
        {:ok, params}
    end
  end

  defp maybe_save_audio(params, key) do
    case params[key] do
      %Plug.Upload{} = upload ->
        case Music.save_upload(upload, "tracks") do
          {:ok, _url, dest_path} ->
            updated =
              params
              |> Map.put("file_path", dest_path)
              |> Map.put("audio_uuid", Ecto.UUID.generate())

            {:ok, updated}

          error ->
            error
        end

      _ ->
        {:ok, params}
    end
  end

  # Топ 100 треков по прослушиваниям
  def top_tracks(conn, _params) do
    tracks =
      Repo.all(
        from t in Track,
          where: t.status == "approved",
          order_by: [desc: t.plays_count, desc: t.inserted_at],
          limit: 100,
          preload: [:artist, :album, :collaborators]
      )
      |> Enum.map(fn t ->
        %{
          id: t.id,
          title: t.title,
          duration_seconds: t.duration_seconds || 0,
          plays_count: t.plays_count || 0,
          likes_count: t.likes_count || 0,
          cover: Track.resolve_cover(t),
          artist: if(t.artist, do: %{id: t.artist.id, name: t.artist.name}, else: nil),
          collaborators: Enum.map(t.collaborators || [], &%{id: &1.id, name: &1.name}),
          album_id: t.album_id,
          age_restriction: t.age_restriction
        }
      end)

    json(conn, %{success: true, data: tracks})
  end

  # Топ 10 артистов
  def top_artists(conn, _params) do
    artists =
      Repo.all(
        from a in Artist,
          where: a.status == "approved",
          order_by: [desc: a.plays_count, desc: a.inserted_at],
          limit: 10
      )

    json(conn, %{success: true, data: artists})
  end

  # Получение одного трека (неодобренные видны только автору и персоналу)
  def get_track(conn, %{"id" => id}) do
    case Music.parse_nullable_id(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})

      valid_id ->
        track =
          Track
          |> Repo.get(valid_id)
          |> Repo.preload([:artist, :album, :collaborators, original_track: [:artist, :album]])

        user = optional_user(conn)

        cond do
          is_nil(track) ->
            conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})

          track.status != "approved" and not staff?(user) and (is_nil(user) or track.creator_id != user.id) ->
            conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})

          true ->
            json(conn, %{track: track})
        end
    end
  end

  # Обновление трека
  def update_track(conn, %{"id" => id} = params) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Track{} = track <- Repo.get(Track, valid_id) do
      if track.creator_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на изменение"})
      else
        safe_params = Map.take(params, ["title", "release_year", "position", "age_restriction", "is_cover", "original_track_id"])

        case track |> Track.changeset(safe_params) |> Repo.update() do
          {:ok, updated} ->
            json(conn, %{success: true, track: updated})

          {:error, changeset} ->
            errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка обновления трека", details: errors})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Трек не найден"})
    end
  end

  # Список избранного
  def list_favorites(conn, params) do
    with {:ok, user} <- authenticate_user(conn) do
      limit = Music.parse_nullable_id(params["limit"])
      tracks = Music.list_user_favorites(user.id, limit)
      json(conn, %{success: true, data: tracks})
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})
    end
  end

  # Идентификаторы избранных треков
  def favorite_ids(conn, _params) do
    with {:ok, user} <- authenticate_user(conn) do
      ids = Music.list_user_favorite_ids(user.id)
      json(conn, %{success: true, data: ids})
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})
    end
  end

  # Добавление и удаление трека из избранного
  def toggle_favorite(conn, %{"track_id" => track_id}) do
    with {:ok, user} <- authenticate_user(conn) do
      case Music.toggle_favorite(user.id, track_id) do
        {:ok, status} ->
          json(conn, %{success: true, status: status, is_favorite: status == :favorited})

        {:error, _reason} ->
          conn |> put_status(:bad_request) |> json(%{error: "Не удалось обновить избранное"})
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})
    end
  end

  def toggle_favorite(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "Не передан track_id"})
  end

  # Список всех плейлистов текущего пользователя
  def list_my_playlists(conn, _params) do
    with {:ok, user} <- authenticate_user(conn) do
      playlists = Music.list_my_playlists(user.id)
      json(conn, %{success: true, data: playlists})
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})
    end
  end

  # Список публичных плейлистов пользователя для отображения в профиле
  def list_user_playlists(conn, %{"id" => user_id}) do
    case Music.parse_nullable_id(user_id) do
      nil ->
        json(conn, %{success: true, data: []})

      uid ->
        playlists = Music.list_user_public_playlists(uid)
        json(conn, %{success: true, data: playlists})
    end
  end

  # Получение плейлиста по ссылке
  def get_playlist(conn, %{"id" => id}) do
    case Music.get_playlist(id) do
      {:ok, playlist} ->
        json(conn, %{success: true, playlist: playlist})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Плейлист не найден"})
    end
  end

  # Создание плейлиста
  def create_playlist(conn, params) do
    with {:ok, user} <- authenticate_user(conn),
         {:ok, params} <- maybe_save_file(params, "cover", "covers") do
      case Music.create_playlist(params, user.id) do
        {:ok, playlist} ->
          conn |> put_status(:created) |> json(%{success: true, playlist: playlist})

        {:error, _changeset} ->
          Music.delete_file(params["cover"])
          conn |> put_status(:bad_request) |> json(%{error: "Ошибка создания плейлиста"})
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      {:error, :invalid_file_type} ->
        conn |> put_status(:bad_request) |> json(%{error: "Недопустимый формат обложки"})

      {:error, :file_too_large} ->
        conn |> put_status(:bad_request) |> json(%{error: "Размер обложки превышает допустимый лимит"})

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки обложки"})
    end
  end

  # Редактирование плейлиста
  def update_playlist(conn, %{"id" => id} = params) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Playlist{} = playlist <- Repo.get(Playlist, valid_id) do
      if playlist.user_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на редактирование плейлиста"})
      else
        old_cover = playlist.cover

        case maybe_save_file(params, "cover", "covers") do
          {:ok, updated_params} ->
            case Music.update_playlist(playlist, updated_params) do
              {:ok, updated} ->
                if updated_params["cover"] && updated_params["cover"] != old_cover do
                  Music.delete_file(old_cover)
                end

                json(conn, %{success: true, playlist: updated})

              {:error, _changeset} ->
                conn |> put_status(:bad_request) |> json(%{error: "Ошибка обновления плейлиста"})
            end

          {:error, :invalid_file_type} ->
            conn |> put_status(:bad_request) |> json(%{error: "Недопустимый формат обложки"})

          {:error, :file_too_large} ->
            conn |> put_status(:bad_request) |> json(%{error: "Размер обложки превышает допустимый лимит"})

          {:error, _} ->
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка загрузки обложки"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Плейлист не найден"})
    end
  end

  # Удаление плейлиста
  def delete_playlist(conn, %{"id" => id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Playlist{} = playlist <- Repo.get(Playlist, valid_id) do
      if playlist.user_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав на удаление плейлиста"})
      else
        case Music.delete_playlist(playlist) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Плейлист удален"})

          {:error, _} ->
            conn |> put_status(:bad_request) |> json(%{error: "Ошибка удаления плейлиста"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Плейлист не найден"})
    end
  end

  # Добавление или удаление трека в плейлисте
  def toggle_playlist_track(conn, %{"id" => id, "track_id" => track_id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Playlist{} = playlist <- Repo.get(Playlist, valid_id) do
      if playlist.user_id != user.id do
        conn |> put_status(:forbidden) |> json(%{error: "Это чужой плейлист"})
      else
        case Music.toggle_track_in_playlist(playlist.id, track_id) do
          {:ok, status} ->
            {:ok, refreshed} = Music.get_playlist(playlist.id)
            json(conn, %{success: true, status: status, playlist: refreshed})

          {:error, _} ->
            conn |> put_status(:bad_request) |> json(%{error: "Не удалось изменить состав плейлиста"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Плейлист не найден"})
    end
  end

  # Удаление трека из плейлиста по параметрам маршрута
  def remove_playlist_track(conn, %{"id" => id, "track_id" => track_id}) do
    with {:ok, user} <- authenticate_user(conn),
         valid_id when not is_nil(valid_id) <- Music.parse_nullable_id(id),
         %Playlist{} = playlist <- Repo.get(Playlist, valid_id) do
      if playlist.user_id != user.id and not staff?(user) do
        conn |> put_status(:forbidden) |> json(%{error: "Нет прав для изменения плейлиста"})
      else
        case Music.remove_track_from_playlist(playlist.id, track_id) do
          {:ok, _} ->
            json(conn, %{success: true, message: "Трек убран из плейлиста"})

          {:error, :not_found} ->
            conn |> put_status(:not_found) |> json(%{error: "Трек не найден в плейлисте"})
        end
      end
    else
      {:error, :unauthorized} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Плейлист не найден"})
    end
  end
end
