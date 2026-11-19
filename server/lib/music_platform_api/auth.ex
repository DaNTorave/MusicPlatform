defmodule MusicPlatformApi.Auth do
  alias MusicPlatformApi.{Repo, User, Token}
  import Ecto.Query

  # Генерация случайного никнейма
  defp generate_random_nickname do
    adjectives = ["cool", "happy", "brave", "smart", "lucky", "wild", "free", "bold", "calm", "swift"]
    nouns = ["panda", "tiger", "eagle", "wolf", "fox", "bear", "lion", "hawk", "dove", "whale"]
    number = Enum.random(1000..9999)

    adjective = Enum.random(adjectives)
    noun = Enum.random(nouns)

    "#{adjective}_#{noun}_#{number}"
  end

  # Поиск по логину или почте
  defp get_user_by_login_or_email(login_or_email) do
    query =
      from u in User,
        where: u.login == ^login_or_email or u.email == ^login_or_email,
        limit: 1

    Repo.one(query)
  end

  # Регистрация
  def register_user(attrs) do
    nickname = Map.get(attrs, "nickname")

    attrs =
      if is_nil(nickname) || String.trim(nickname) == "" do
        Map.put(attrs, "nickname", generate_random_nickname())
      else
        attrs
      end

    case %User{}
         |> User.registration_changeset(attrs)
         |> Repo.insert() do
      {:ok, user} ->
        loaded_user =
          if is_nil(user.id) do
            case Repo.get_by(User, login: user.login) do
              nil -> user
              found_user -> found_user
            end
          else
            user
          end

        case MusicPlatformApi.Auth.generate_token(loaded_user) do
          {:ok, token} -> {:ok, loaded_user, token}
          {:error, reason} -> {:error, reason}
        end

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  # Аутентификация по логину или почте и паролю
  def authenticate(login_or_email, password) do
    user = get_user_by_login_or_email(login_or_email)

    case user do
      nil ->
        Pbkdf2.no_user_verify()
        {:error, "Неверный логин или пароль"}

      user ->
        if User.valid_password?(user, password) do
          {:ok, user}
        else
          {:error, "Неверный логин или пароль"}
        end
    end
  end

  # Генерация токена на 30 дней
  def generate_token(user) do
    user_id = user.id

    if is_nil(user_id) do
      {:error, "User ID is nil"}
    else
      claims = %{
        "user_id" => user_id,
        "login" => user.login,
        "email" => user.email,
        "nickname" => user.nickname || "",
        "role" => user.role,
        "exp" => System.system_time(:second) + 86400 * 30
      }

      case Token.generate_token(claims) do
        {:ok, token, _claims} -> {:ok, token}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  # Проверка токена на валидность и срок действия
  def verify_token(token) do
    case Token.verify_token(token) do
      {:ok, claims} -> {:ok, claims}
      {:error, reason} -> {:error, "Недействительный токен: #{reason}"}
    end
  end

  # Извлечение пользователя из БД по токену
  def get_user_from_token(token) do
    case verify_token(token) do
      {:ok, claims} ->
        case claims do
          %{"user_id" => user_id} when is_integer(user_id) ->
            Repo.get(User, user_id)

          %{"user_id" => user_id} when is_binary(user_id) ->
            case Integer.parse(user_id) do
              {int_id, ""} -> Repo.get(User, int_id)
              _ -> nil
            end

          _ ->
            nil
        end

      {:error, _} ->
        nil
    end
  end

  def get_user(id) when is_integer(id), do: Repo.get(User, id)

  def get_user(id) when is_binary(id) do
    case Integer.parse(id) do
      {int_id, ""} -> Repo.get(User, int_id)
      _ -> nil
    end
  end

  def get_user(_), do: nil

  def get_user_by_login(login), do: Repo.get_by(User, login: login)
  def get_user_by_email(email), do: Repo.get_by(User, email: email)
  def get_user_by_nickname(nickname), do: Repo.get_by(User, nickname: nickname)

  # Обновление разрешенных атрибутов пользователя
  def update_user(%User{} = user, attrs) do
    user
    |> User.update_changeset(attrs)
    |> Repo.update()
  end

  # Хеширование и обновление пароля в БД с валидацией длины
  def update_password(%User{} = user, new_password) do
    changeset =
      user
      |> Ecto.Changeset.cast(%{password: new_password}, [:password])
      |> Ecto.Changeset.validate_required([:password])
      |> Ecto.Changeset.validate_length(:password, min: 8)
      |> User.put_password_hash()

    Repo.update(changeset)
  end

  # Обновление никнейма с валидациями
  def update_nickname(user, new_nickname) do
    new_nickname = String.trim(new_nickname)

    if new_nickname == "" do
      {:error, "Ник не может быть пустым"}
    else
      existing_user = get_user_by_nickname(new_nickname)

      cond do
        existing_user && existing_user.id != user.id ->
          {:error, "Ник уже занят"}

        true ->
          user
          |> Ecto.Changeset.cast(%{nickname: new_nickname}, [:nickname])
          |> Ecto.Changeset.validate_length(:nickname, min: 1, max: 50)
          |> Repo.update()
      end
    end
  end

  def check_password(user, password), do: User.valid_password?(user, password)

  # Смена пароля с подтверждением старого
  def change_password(%User{} = user, current_password, new_password, new_password_confirmation) do
    cond do
      !User.valid_password?(user, current_password) -> {:error, :invalid_current_password}
      new_password != new_password_confirmation -> {:error, :password_mismatch}
      true -> update_password(user, new_password)
    end
  end

  # Получение списка пользователей для панели управления ролями
  def list_users(search_query \\ "") do
    base = from u in User, order_by: [asc: u.id]

    query =
      if search_query != "" and is_binary(search_query) do
        term = "%#{String.trim(search_query)}%"
        from u in base, where: ilike(u.login, ^term) or ilike(u.email, ^term) or ilike(u.nickname, ^term)
      else
        base
      end

    Repo.all(query)
  end

  # Смена роли пользователя
  def change_user_role(%User{} = target_user, new_role) do
    target_user
    |> User.role_changeset(%{role: new_role})
    |> Repo.update()
  end
end
