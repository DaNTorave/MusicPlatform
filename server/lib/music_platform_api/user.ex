defmodule MusicPlatformApi.User do
  use Ecto.Schema
  import Ecto.Changeset
  alias MusicPlatformApi.PasswordUtils

  @roles ["member", "moderator", "admin", "owner"]
  @statuses ["pending", "approved"]
  @reserved_logins ~w(admin administrator owner moderator moder support system root info help api staff)

  schema "users" do
    field :login, :string
    field :email, :string
    field :password_hash, :string
    field :password, :string, virtual: true
    field :nickname, :string
    field :avatar, :string
    field :role, :string, default: "member"
    field :status, :string, default: "pending"
    field :is_premium, :boolean, default: false

    field :terms_accepted, :boolean, virtual: true
    field :privacy_accepted, :boolean, virtual: true
    field :terms_accepted_at, :utc_datetime_usec
    field :privacy_accepted_at, :utc_datetime_usec

    field :preferred_genres, {:array, :string}, default: []
    field :preferred_artist_ids, {:array, :integer}, default: []

    has_many :artists, MusicPlatformApi.Music.Artist, foreign_key: :creator_id
    has_many :albums, MusicPlatformApi.Music.Album, foreign_key: :creator_id
    has_many :tracks, MusicPlatformApi.Music.Track, foreign_key: :creator_id
    has_many :notifications, MusicPlatformApi.Notifications.Notification

    timestamps(type: :utc_datetime_usec)
  end

  def roles, do: @roles
  def statuses, do: @statuses
  def reserved_logins, do: @reserved_logins

  # Валидация при регистрации с проверкой уникальности логина и согласий по 152-ФЗ
  def registration_changeset(user, attrs) do
    now = DateTime.utc_now()

    user
    |> cast(attrs, [
      :login,
      :email,
      :password,
      :nickname,
      :preferred_genres,
      :preferred_artist_ids,
      :terms_accepted,
      :privacy_accepted
    ])
    |> update_change(:login, &String.trim/1)
    |> update_change(:email, fn e -> e |> String.trim() |> String.downcase() end)
    |> validate_required([:login, :email, :password])
    |> validate_acceptance(:terms_accepted, message: "Необходимо принять пользовательское соглашение")
    |> validate_acceptance(:privacy_accepted, message: "Необходимо дать согласие на обработку персональных данных")
    |> validate_length(:login, min: 3, max: 30)
    |> validate_format(:login, ~r/^[a-zA-Z0-9_]+$/)
    |> validate_not_reserved_login()
    |> validate_format(:email, ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    |> validate_length(:password, min: 8)
    |> unique_constraint(:login, name: :users_login_index)
    |> unique_constraint(:login, name: :users_lower_login_index, message: "Логин уже занят")
    |> unique_constraint(:email, name: :users_email_index)
    |> put_change(:role, "member")
    |> put_change(:status, "pending")
    |> put_change(:terms_accepted_at, now)
    |> put_change(:privacy_accepted_at, now)
    |> put_password_hash()
  end

  defp validate_not_reserved_login(changeset) do
    case get_field(changeset, :login) do
      login when is_binary(login) ->
        if String.downcase(login) in @reserved_logins do
          add_error(changeset, :login, "Этот логин зарезервирован системой")
        else
          changeset
        end

      _ ->
        changeset
    end
  end

  # Обновление публичных данных профиля
  def update_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :nickname,
      :avatar,
      :is_premium,
      :preferred_genres,
      :preferred_artist_ids
    ])
    |> validate_length(:nickname, min: 1, max: 50)
  end

  # Изменение роли пользователя
  def role_changeset(user, attrs) do
    user
    |> cast(attrs, [:role])
    |> validate_required([:role])
    |> validate_inclusion(:role, @roles)
  end

  # Изменение статуса модерации пользователя
  def status_changeset(user, attrs) do
    user
    |> cast(attrs, [:status])
    |> validate_required([:status])
    |> validate_inclusion(:status, @statuses)
  end

  # Хеширование пароля с применением перца и соли Pbkdf2
  def put_password_hash(changeset) do
    case get_change(changeset, :password) do
      nil ->
        changeset

      password ->
        peppered = PasswordUtils.apply_pepper(password)
        put_change(changeset, :password_hash, Pbkdf2.hash_pwd_salt(peppered))
    end
  end

  # Проверка валидности пароля
  def valid_password?(%__MODULE__{password_hash: hash}, password)
      when is_binary(hash) and is_binary(password) do
    peppered = PasswordUtils.apply_pepper(password)
    Pbkdf2.verify_pass(peppered, hash) or Pbkdf2.verify_pass(password, hash)
  end

  def valid_password?(_, _), do: false
end
