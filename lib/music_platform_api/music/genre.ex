defmodule MusicPlatformApi.Music.Genre do
  use Ecto.Schema
  import Ecto.Changeset

  @derive {Jason.Encoder, only: [:id, :key, :title_ru, :inserted_at, :updated_at]}
  schema "genres" do
    field :key, :string
    field :title_ru, :string

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(genre, attrs) do
    genre
    |> cast(attrs, [:key, :title_ru])
    |> validate_required([:key, :title_ru])
    |> validate_format(:key, ~r/^[a-z0-9_\-]+$/, message: "Ключ может содержать только латиницу в нижнем регистре, цифры и дефис")
    |> unique_constraint(:key, name: :genres_key_index)
  end
end
