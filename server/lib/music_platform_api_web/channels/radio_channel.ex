defmodule MusicPlatformApiWeb.RadioChannel do
  use MusicPlatformApiWeb, :channel
  alias MusicPlatformApi.Radio.SessionServer

  @impl true
  def join("radio:" <> user_id_str, _payload, socket) do
    if to_string(socket.assigns.user_id) == user_id_str do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_in("start_radio", payload, socket) do
    user_id = socket.assigns.user_id
    seed_genre = Map.get(payload, "genre")

    {:ok, tracks} = SessionServer.start_stream(user_id, seed_genre)
    {:reply, {:ok, %{tracks: tracks}}, socket}
  end

  @impl true
  def handle_in("request_more", _payload, socket) do
    user_id = socket.assigns.user_id
    {:ok, tracks} = SessionServer.next_batch(user_id)
    {:reply, {:ok, %{tracks: tracks}}, socket}
  end

  @impl true
  def handle_in("feedback", %{"track_id" => track_id, "event_type" => event_type} = payload, socket) do
    user_id = socket.assigns.user_id
    duration_ms = Map.get(payload, "listen_duration_ms", 0)

    {:ok, rebuilt_tracks} = SessionServer.handle_feedback(user_id, track_id, event_type, duration_ms)

    # Если очередь была перестроена (например, после skip_early или dislike), отправляем обновление
    if rebuilt_tracks != [] do
      push(socket, "queue_replaced", %{tracks: rebuilt_tracks})
    end

    {:reply, :ok, socket}
  end
end
