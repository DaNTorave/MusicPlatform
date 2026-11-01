defmodule MusicPlatformApi.Music.Artist do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  alias MusicPlatformApi.Repo
  alias MusicPlatformApi.Music.Genre

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :avatar,
             :genre,
             :genres,
             :plays_count,
             :likes_count,
             :status,
             :moderation_comment,
             :creator_id,
             :inserted_at,
             :updated_at
           ]}
  schema "artists" do
    field :name, :string
    field :avatar, :string
    field :genre, :string
    field :genres, {:array, :string}, default: []
    field :plays_count, :integer, default: 0
    field :likes_count, :integer, default: 0
    field :status, :string, default: "pending"
    field :moderation_comment, :string

    belongs_to :creator, MusicPlatformApi.User, foreign_key: :creator_id
    has_many :albums, MusicPlatformApi.Music.Album
    has_many :tracks, MusicPlatformApi.Music.Track

    many_to_many :collab_tracks, MusicPlatformApi.Music.Track,
      join_through: "track_collaborators"

    timestamps(type: :utc_datetime_usec)
  end

  # Валидация данных артиста
  def changeset(artist, attrs) do
    artist
    |> cast(attrs, [:name, :avatar, :genre, :genres, :creator_id])
    |> validate_required([:name, :creator_id])
    |> validate_length(:name, min: 1, max: 100)
    |> normalize_and_validate_genres()
  end

  # Модерация данных артиста
  def moderation_changeset(artist, attrs) do
    artist
    |> cast(attrs, [:status, :moderation_comment, :name, :genre, :genres])
    |> validate_inclusion(:status, ["pending", "approved", "rejected"])
    |> normalize_and_validate_genres()
  end

  # Проверка жанров напрямую по таблице genres
  defp normalize_and_validate_genres(changeset) do
    genres = get_change(changeset, :genres)
    single_genre = get_change(changeset, :genre)

    list =
      cond do
        is_list(genres) and length(genres) > 0 ->
          genres

        is_binary(single_genre) and String.trim(single_genre) != "" ->
          single_genre
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))

        true ->
          []
      end

    if list != [] do
      cleaned = list |> Enum.map(&to_string/1) |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == "")) |> Enum.uniq()
      allowed_keys = Repo.all(from g in Genre, select: g.key)

      # Если в БД вообще нет жанров, создание артиста блокируется до наполнения кластера
      if allowed_keys == [] do
        add_error(changeset, :genres, "Кластер жанров в системе пуст. Сначала добавьте жанры в панель.")
      else
        invalid = Enum.reject(cleaned, fn g -> g in allowed_keys end)

        if invalid == [] do
          changeset
          |> put_change(:genres, cleaned)
          |> put_change(:genre, Enum.join(cleaned, ", "))
        else
          add_error(changeset, :genres, "Жанры не входят в утвержденный кластер: #{inspect(invalid)}")
        end
      end
    else
      if get_field(changeset, :genres) == [] and (is_nil(get_field(changeset, :genre)) or get_field(changeset, :genre) == "") do
        add_error(changeset, :genres, "Необходимо указать хотя бы один жанр из кластера")
      else
        changeset
      end
    end
  end
end
