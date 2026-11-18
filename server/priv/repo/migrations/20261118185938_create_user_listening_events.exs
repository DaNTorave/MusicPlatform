defmodule MusicPlatformApi.Repo.Migrations.CreateUserListeningEvents do
  use Ecto.Migration

  def change do
    create table(:user_listening_events) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :track_id, references(:tracks, on_delete: :delete_all), null: false
      add :event_type, :string, null: false
      add :listen_duration_ms, :integer, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:user_listening_events, [:user_id, :inserted_at])
    create index(:user_listening_events, [:track_id, :event_type])
  end
end
