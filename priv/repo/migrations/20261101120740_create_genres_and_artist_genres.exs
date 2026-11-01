defmodule MusicPlatformApi.Repo.Migrations.CreateGenresAndArtistGenres do
  use Ecto.Migration

  def change do
    create table(:genres) do
      add :key, :string, null: false
      add :title_ru, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:genres, [:key])

    alter table(:artists) do
      add :genres, {:array, :string}, default: []
    end

    create index(:artists, [:genres], using: "GIN")
  end
end
