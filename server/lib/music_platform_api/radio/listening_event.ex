defmodule MusicPlatformApi.Radio.ListeningEvent do
  use Ecto.Schema
  import Ecto.Changeset

  @allowed_events ["play_start", "skip_early", "complete", "like", "dislike"]

  schema "user_listening_events" do
    field :event_type, :string
    field :listen_duration_ms, :integer, default: 0

    belongs_to :user, MusicPlatformApi.User
    belongs_to :track, MusicPlatformApi.Music.Track

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:user_id, :track_id, :event_type, :listen_duration_ms])
    |> validate_required([:user_id, :track_id, :event_type])
    |> validate_inclusion(:event_type, @allowed_events)
  end
end
