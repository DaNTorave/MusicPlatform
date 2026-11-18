defmodule MusicPlatformApi.Radio.SessionServer do
  use GenServer
  alias MusicPlatformApi.Repo
  alias MusicPlatformApi.Music.Track
  alias MusicPlatformApi.Radio.Engine

  @idle_timeout_ms 30 * 60 * 1000

  def start_link(user_id) do
    GenServer.start_link(__MODULE__, user_id, name: via_tuple(user_id))
  end

  def via_tuple(user_id) do
    {:via, Registry, {MusicPlatformApi.RadioRegistry, user_id}}
  end

  def get_or_start(user_id) do
    case Registry.lookup(MusicPlatformApi.RadioRegistry, user_id) do
      [{pid, _}] ->
        {:ok, pid}

      [] ->
        DynamicSupervisor.start_child(
          MusicPlatformApi.RadioSupervisor,
          {__MODULE__, user_id}
        )
    end
  end

  def start_stream(user_id, seed_genre \\ nil) do
    {:ok, pid} = get_or_start(user_id)
    GenServer.call(pid, {:start_stream, seed_genre})
  end

  def next_batch(user_id) do
    {:ok, pid} = get_or_start(user_id)
    GenServer.call(pid, :next_batch)
  end

  def handle_feedback(user_id, track_id, event_type, duration_ms \\ 0) do
    {:ok, pid} = get_or_start(user_id)
    GenServer.call(pid, {:feedback, track_id, event_type, duration_ms})
  end

  # Callbacks
  @impl true
  def init(user_id) do
    weights = Engine.load_initial_weights(user_id)

    state = %{
      user_id: user_id,
      genre_weights: weights.genre_weights,
      preferred_artist_ids: weights.preferred_artist_ids,
      disliked_ids: weights.disliked_ids,
      history_ids: MapSet.new(),
      recent_artist_ids: [],
      queue: []
    }

    {:ok, state, @idle_timeout_ms}
  end

  @impl true
  def handle_call({:start_stream, seed_genre}, _from, state) do
    updated_weights =
      if is_binary(seed_genre) and seed_genre != "" do
        Map.update(state.genre_weights, seed_genre, 6.0, &(&1 + 6.0))
      else
        state.genre_weights
      end

    state = %{state | genre_weights: updated_weights}
    tracks = Engine.recommend_next(state, 5)
    state = register_recommended_tracks(state, tracks)

    {:reply, {:ok, tracks}, state, @idle_timeout_ms}
  end

  @impl true
  def handle_call(:next_batch, _from, state) do
    tracks = Engine.recommend_next(state, 4)
    state = register_recommended_tracks(state, tracks)

    {:reply, {:ok, tracks}, state, @idle_timeout_ms}
  end

  @impl true
  def handle_call({:feedback, track_id, event_type, duration_ms}, _from, state) do
    Engine.record_event_async(state.user_id, track_id, event_type, duration_ms)

    track = Repo.get(Track, track_id) |> Repo.preload(:artist)
    genres = if track && track.artist, do: track.artist.genres || [], else: []

    state =
      case event_type do
        "skip_early" ->
          new_weights = adjust_genres(state.genre_weights, genres, -1.5)
          new_tracks = Engine.recommend_next(%{state | genre_weights: new_weights}, 4)
          state = %{state | genre_weights: new_weights}
          register_recommended_tracks(state, new_tracks)

        "dislike" ->
          new_weights = adjust_genres(state.genre_weights, genres, -3.5)
          new_disliked = MapSet.put(state.disliked_ids, track_id)

          state = %{
            state
            | genre_weights: new_weights,
              disliked_ids: new_disliked
          }

          new_tracks = Engine.recommend_next(state, 4)
          register_recommended_tracks(state, new_tracks)

        "like" ->
          new_weights = adjust_genres(state.genre_weights, genres, 2.5)
          %{state | genre_weights: new_weights, queue: []}

        "complete" ->
          new_weights = adjust_genres(state.genre_weights, genres, 1.0)
          %{state | genre_weights: new_weights, queue: []}

        _ ->
          %{state | queue: []}
      end

    {:reply, {:ok, state.queue}, state, @idle_timeout_ms}
  end

  @impl true
  def handle_info(:timeout, state) do
    {:stop, :normal, state}
  end

  defp adjust_genres(weights, genres, delta) do
    Enum.reduce(genres, weights, fn g, acc ->
      current = Map.get(acc, g, 0.0)
      updated = max(current + delta, -5.0)
      Map.put(acc, g, updated)
    end)
  end

  defp register_recommended_tracks(state, tracks) do
    new_ids = Enum.map(tracks, & &1.id) |> MapSet.new()
    new_artists = Enum.map(tracks, & &1.artist_id)

    %{
      state
      | history_ids: MapSet.union(state.history_ids, new_ids),
        recent_artist_ids: Enum.take(new_artists ++ state.recent_artist_ids, 10),
        queue: tracks
    }
  end
end
