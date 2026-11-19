defmodule MusicPlatformApi.User do
  use Ecto.Schema
  import Ecto.Changeset
  alias MusicPlatformApi.PasswordUtils

  # Иерархия доступных ролей
  @roles ["member", "moderator", "admin", "owner"]

  schema "users" do
    field :login, :string
    field :email, :string
    field :password_hash, :string
    field :password, :string, virtual: true
    field :nickname, :string
    field :avatar, :string
    field :role, :string, default: "member"
    field :is_premium, :boolean, default: false

    field :preferred_genres, {:array, :string}, default: []
    field :preferred_artist_ids, {:array, :integer}, default: []

    has_many :artists, MusicPlatformApi.Music.Artist, foreign_key: :creator_id
    has_many :albums, MusicPlatformApi.Music.Album, foreign_key: :creator_id
    has_many :tracks, MusicPlatformApi.Music.Track, foreign_key: :creator_id
    has_many :notifications, MusicPlatformApi.Notifications.Notification

    timestamps(type: :utc_datetime_usec)
  end

  def roles, do: @roles

  # Валидация при регистрации
  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :login,
      :email,
      :password,
      :nickname,
      :preferred_genres,
      :preferred_artist_ids
    ])
    |> validate_required([:login, :email, :password])
    |> validate_length(:login, min: 3, max: 30)
    |> validate_format(:login, ~r/^[a-zA-Z0-9_]+$/)
    |> validate_format(:email, ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    |> validate_length(:password, min: 8)
    |> unique_constraint(:login, name: :users_login_index)
    |> unique_constraint(:email, name: :users_email_index)
    |> put_change(:role, "member")
    |> put_password_hash()
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

  # Проверка валидности пароля (с поддержкой совместимости для старых хешей без перца)
  def valid_password?(%__MODULE__{password_hash: hash}, password)
      when is_binary(hash) and is_binary(password) do
    peppered = PasswordUtils.apply_pepper(password)
    Pbkdf2.verify_pass(peppered, hash) or Pbkdf2.verify_pass(password, hash)
  end

  def valid_password?(_, _), do: false
end
