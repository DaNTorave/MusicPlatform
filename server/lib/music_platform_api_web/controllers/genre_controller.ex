defmodule MusicPlatformApiWeb.GenreController do
  use MusicPlatformApiWeb, :controller
  import Ecto.Query
  alias MusicPlatformApi.{Auth, Repo}
  alias MusicPlatformApi.Music.Genre

  defp require_approved_user(conn) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         user when not is_nil(user) <- Auth.get_user_from_token(token),
         true <- Auth.approved?(user) do
      {:ok, user}
    else
      _ -> {:error, :unauthorized}
    end
  end

  defp require_owner(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         user when not is_nil(user) and user.role == "owner" and user.status == "approved" <-
           Auth.get_user_from_token(token) do
      assign(conn, :current_user, user)
    else
      _ ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "Доступ запрещен. Только владелец может управлять кластером жанров."})
        |> halt()
    end
  end

  def index(conn, _params) do
    case require_approved_user(conn) do
      {:ok, _user} ->
        genres = Repo.all(from g in Genre, order_by: [asc: g.id])
        json(conn, %{success: true, data: genres})

      {:error, _} ->
        conn |> put_status(:unauthorized) |> json(%{error: "Требуется авторизация"})
    end
  end

  def create(conn, params) do
    conn = require_owner(conn, [])
    if conn.halted do
      conn
    else
      changeset = Genre.changeset(%Genre{}, params)

      case Repo.insert(changeset) do
        {:ok, genre} ->
          conn
          |> put_status(:created)
          |> json(%{success: true, data: genre})

        {:error, %Ecto.Changeset{} = cs} ->
          errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _opts} -> msg end)
          conn
          |> put_status(:bad_request)
          |> json(%{error: "Ошибка добавления жанра", details: errors})
      end
    end
  end

  def update(conn, %{"id" => id} = params) do
    conn = require_owner(conn, [])
    if conn.halted do
      conn
    else
      case Repo.get(Genre, id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Жанр не найден"})

        genre ->
          changeset = Genre.changeset(genre, params)

          case Repo.update(changeset) do
            {:ok, updated} ->
              json(conn, %{success: true, data: updated})

            {:error, %Ecto.Changeset{} = cs} ->
              errors = Ecto.Changeset.traverse_errors(cs, fn {msg, _opts} -> msg end)
              conn
              |> put_status(:bad_request)
              |> json(%{error: "Ошибка обновления жанра", details: errors})
          end
      end
    end
  end

  def delete(conn, %{"id" => id}) do
    conn = require_owner(conn, [])
    if conn.halted do
      conn
    else
      case Repo.get(Genre, id) do
        nil ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "Жанр не найден"})

        genre ->
          case Repo.delete(genre) do
            {:ok, _} ->
              json(conn, %{success: true, message: "Жанр удален"})

            {:error, _} ->
              conn
              |> put_status(:bad_request)
              |> json(%{error: "Не удалось удалить жанр"})
          end
      end
    end
  end
end
