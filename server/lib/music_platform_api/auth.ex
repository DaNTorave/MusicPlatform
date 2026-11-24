defmodule MusicPlatformApi.Auth do
  alias MusicPlatformApi.{Repo, User, Token, Music}
  alias MusicPlatformApi.Notifications.Notification
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

  # Поиск по логину (без учета регистра) или почте
  defp get_user_by_login_or_email(login_or_email) do
    normalized = String.trim(login_or_email)

    query =
      from u in User,
        where:
          fragment("lower(?)", u.login) == ^String.downcase(normalized) or
            fragment("lower(?)", u.email) == ^String.downcase(normalized),
        limit: 1

    Repo.one(query)
  end

  # Проверка доступности логина при регистрации
  def login_available?(login) when is_binary(login) do
    trimmed = String.trim(login)
    lowered = String.downcase(trimmed)

    cond do
      String.length(trimmed) < 3 or String.length(trimmed) > 30 ->
        {:error, "Логин должен содержать от 3 до 30 символов"}

      not Regex.match?(~r/^[a-zA-Z0-9_]+$/, trimmed) ->
        {:error, "Допустимы только латинские буквы, цифры и символ подчеркивания"}

      lowered in User.reserved_logins() ->
        {:error, "Этот логин зарезервирован системой"}

      not is_nil(get_user_by_login(trimmed)) ->
        {:error, "Этот логин уже занят"}

      true ->
        :ok
    end
  end

  def login_available?(_), do: {:error, "Некорректный логин"}

  # Регистрация пользователя со статусом pending
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
            case get_user_by_login(user.login) do
              nil -> user
              found_user -> found_user
            end
          else
            user
          end

        case generate_token(loaded_user) do
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
        "status" => user.status,
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

  # Проверка, одобрен ли пользователь
  def approved?(%User{status: "approved"}), do: true
  def approved?(_), do: false

  def get_user(id) when is_integer(id), do: Repo.get(User, id)

  def get_user(id) when is_binary(id) do
    case Integer.parse(id) do
      {int_id, ""} -> Repo.get(User, int_id)
      _ -> nil
    end
  end

  def get_user(_), do: nil

  def get_user_by_login(login) when is_binary(login) do
    normalized = login |> String.trim() |> String.downcase()
    Repo.one(from u in User, where: fragment("lower(?)", u.login) == ^normalized, limit: 1)
  end

  def get_user_by_login(_), do: nil

  def get_user_by_email(email) when is_binary(email) do
    normalized = email |> String.trim() |> String.downcase()
    Repo.one(from u in User, where: fragment("lower(?)", u.email) == ^normalized, limit: 1)
  end

  def get_user_by_email(_), do: nil

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

  # Получение списка одобренных пользователей для панели управления ролями
  def list_users(search_query \\ "") do
    base = from u in User, where: u.status == "approved", order_by: [asc: u.id]

    query =
      if search_query != "" and is_binary(search_query) do
        term = "%#{String.trim(search_query)}%"
        from u in base, where: ilike(u.login, ^term) or ilike(u.email, ^term) or ilike(u.nickname, ^term)
      else
        base
      end

    Repo.all(query)
  end

  # Получение списка пользователей, ожидающих одобрения регистрации
  def list_pending_users do
    Repo.all(from u in User, where: u.status == "pending", order_by: [asc: u.inserted_at])
  end

  # Одобрение заявки пользователя
  def approve_user(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      %User{status: "approved"} = user ->
        {:ok, user}

      %User{} = user ->
        Repo.transaction(fn ->
          updated_user =
            user
            |> User.status_changeset(%{status: "approved"})
            |> Repo.update!()

          %Notification{}
          |> Notification.changeset(%{
            user_id: updated_user.id,
            title: "Доступ одобрен!",
            message: "Ваша регистрация подтверждена администратором. Теперь вам доступен весь каталог площадки.",
            type: "success"
          })
          |> Repo.insert!()

          updated_user
        end)
    end
  end

  # Отклонение заявки пользователя с полным удалением учетной записи из БД
  def reject_and_delete_user(user_id) do
    case get_user(user_id) do
      nil ->
        {:error, :not_found}

      %User{role: role} when role in ["owner", "admin", "moderator"] ->
        {:error, :cannot_delete_staff}

      %User{status: "approved"} ->
        {:error, :already_approved}

      %User{} = user ->
        avatar_path = user.avatar

        case Repo.delete(user) do
          {:ok, deleted} ->
            Music.delete_file(avatar_path)
            {:ok, deleted}

          {:error, changeset} ->
            {:error, changeset}
        end
    end
  end

  # Смена роли пользователя
  def change_user_role(%User{} = target_user, new_role) do
    target_user
    |> User.role_changeset(%{role: new_role})
    |> Repo.update()
  end
end
