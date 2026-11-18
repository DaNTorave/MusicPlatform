defmodule MusicPlatformApi.Radio.Engine do
  import Ecto.Query
  alias MusicPlatformApi.Repo
  alias MusicPlatformApi.User
  alias MusicPlatformApi.Music.{Track, FavoriteTrack}
  alias MusicPlatformApi.Radio.ListeningEvent

  # Загрузка начальных весов жанров и артистов из профиля и избранного
  def load_initial_weights(user_id) do
    user = Repo.get(User, user_id)

    base_genres =
      if user && is_list(user.preferred_genres) do
        Map.new(user.preferred_genres, fn g -> {g, 3.0} end)
      else
        %{}
      end

    fav_genres =
      from(ft in FavoriteTrack,
        join: t in Track,
        on: ft.track_id == t.id,
        join: a in assoc(t, :artist),
        where: ft.user_id == ^user_id,
        select: a.genres
      )
      |> Repo.all()
      |> List.flatten()
      |> Enum.reduce(base_genres, fn genre, acc ->
        Map.update(acc, genre, 1.5, &(&1 + 1.5))
      end)

    disliked_track_ids =
      from(e in ListeningEvent,
        where: e.user_id == ^user_id and e.event_type == "dislike",
        select: e.track_id
      )
      |> Repo.all()
      |> MapSet.new()

    %{
      genre_weights: fav_genres,
      preferred_artist_ids: (user && user.preferred_artist_ids) || [],
      disliked_ids: disliked_track_ids
    }
  end

  # Подбор следующей пачки треков (по умолчанию 4 трека в буфер)
  def recommend_next(state, count \\ 4) do
    excluded_ids =
      state.history_ids
      |> MapSet.union(state.disliked_ids)
      |> MapSet.to_list()

    candidates_query =
      from(t in Track,
        join: a in assoc(t, :artist),
        where: t.status == "approved" and a.status == "approved",
        preload: [:artist, :album, :collaborators],
        limit: 120
      )

    candidates_query =
      if excluded_ids != [] do
        where(candidates_query, [t], t.id not in ^excluded_ids)
      else
        candidates_query
      end

    candidates = Repo.all(candidates_query)

    # Если все треки уже проиграны, сбрасываем историю, оставляя только дизлайки
    candidates =
      if candidates == [] do
        disliked = MapSet.to_list(state.disliked_ids)

        fallback_query =
          from(t in Track,
            join: a in assoc(t, :artist),
            where: t.status == "approved" and a.status == "approved",
            preload: [:artist, :album, :collaborators],
            limit: 60
          )

        fallback_query =
          if disliked != [] do
            where(fallback_query, [t], t.id not in ^disliked)
          else
            fallback_query
          end

        Repo.all(fallback_query)
      else
        candidates
      end

    scored =
      candidates
      |> Enum.map(fn track ->
        score = calculate_track_score(track, state)
        {score, track}
      end)
      |> Enum.sort_by(fn {score, _track} -> score end, :desc)

    # Берем топ-20 по очкам и выбираем случайные count треков для разнообразия
    top_pool = Enum.take(scored, max(count * 4, 12))

    top_pool
    |> Enum.shuffle()
    |> Enum.take(count)
    |> Enum.map(fn {_score, track} -> track end)
  end

  defp calculate_track_score(track, state) do
    artist_genres =
      if track.artist && is_list(track.artist.genres) do
        track.artist.genres
      else
        []
      end

    # Совпадение по динамическим весам жанров
    genre_score =
      Enum.reduce(artist_genres, 0.0, fn g, acc ->
        acc + Map.get(state.genre_weights, g, 0.0)
      end)

    # Бонус за любимого артиста из профиля
    artist_bonus =
      if track.artist_id in state.preferred_artist_ids do
        3.0
      else
        0.0
      end

    # Штраф за недавнее воспроизведение этого же артиста (чтобы не шли подряд)
    recent_artist_penalty =
      if track.artist_id in state.recent_artist_ids do
        -4.5
      else
        0.0
      end

    # Небольшой вес популярности (логарифмический, чтобы не забивать новинки)
    popularity_score = :math.log10(max(track.plays_count + track.likes_count * 3, 1)) * 0.6

    # Фактор эксплорации (случайный шум для открытия новой музыки)
    exploration_noise = :rand.uniform() * 2.2

    genre_score + artist_bonus + recent_artist_penalty + popularity_score + exploration_noise
  end

  # Асинхронная запись телеметрии в PostgreSQL
  def record_event_async(user_id, track_id, event_type, duration_ms \\ 0) do
    Task.start(fn ->
      %ListeningEvent{}
      |> ListeningEvent.changeset(%{
        user_id: user_id,
        track_id: track_id,
        event_type: event_type,
        listen_duration_ms: duration_ms
      })
      |> Repo.insert()
    end)
  end
end
