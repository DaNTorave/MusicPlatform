defmodule MusicPlatformApi.Repo.Migrations.AddPreferencesToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :preferred_genres, {:array, :string}, default: []
      add :preferred_artist_ids, {:array, :bigint}, default: []
    end

    create index(:users, [:preferred_genres], using: "GIN")
    create index(:users, [:preferred_artist_ids], using: "GIN")
  end
end
