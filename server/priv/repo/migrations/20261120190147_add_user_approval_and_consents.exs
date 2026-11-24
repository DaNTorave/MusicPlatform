defmodule MusicPlatformApi.Repo.Migrations.AddUserApprovalAndConsents do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add :status, :string, default: "pending", null: false
      add :terms_accepted_at, :utc_datetime_usec
      add :privacy_accepted_at, :utc_datetime_usec
    end

    execute "UPDATE users SET status = 'approved'"

    create unique_index(:users, ["lower(login)"], name: :users_lower_login_index)
    create index(:users, [:status])
  end

  def down do
    drop index(:users, [:status])
    drop index(:users, ["lower(login)"], name: :users_lower_login_index)

    alter table(:users) do
      remove :privacy_accepted_at
      remove :terms_accepted_at
      remove :status
    end
  end
end
