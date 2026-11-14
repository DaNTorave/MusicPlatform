import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { useAudioPlayer } from '../context/AudioContext';

import TrackRow from '../components/TrackRow';
import InputField from '../components/InputField';
import Button from '../components/Button';

import favoriteIcon from '../assets/favorite.svg';

import '../styles/FavoritesPage.css';

export default function FavoritesPage() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  const currentUser = apiClient.getUser();

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getFavorites();
      if (res?.data) {
        setTracks(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    fetchFavorites();

    const handleUpdate = () => fetchFavorites();
    window.addEventListener('favorites:updated', handleUpdate);
    return () => window.removeEventListener('favorites:updated', handleUpdate);
  }, []);

  const filteredTracks = tracks.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const titleMatch = t.title?.toLowerCase().includes(q);
    const artistMatch = t.artist?.name?.toLowerCase().includes(q);
    return titleMatch || artistMatch;
  });

  return (
    <div className="favorites-page-artist-page">
      <div className="favorites-page-artist-header">
        <div className="favorites-header-icon-box">
          <img src={favoriteIcon} alt="fav" className="favorites-header-icon-img" />
        </div>
        <div className="favorites-page-artist-info">
          <span className="favorites-page-artist-tag favorites-header-tag">
            Вам понравилось
          </span>
          <h1 className="favorites-page-artist-title">Избранные треки</h1>
          <p className="favorites-page-artist-meta-string">Всего треков: {tracks.length}</p>
        </div>
      </div>

      <div className="favorites-page-content-search favorites-search-block">
        <div className="favorites-page-search-bar-wrapper">
          <InputField
            type="text"
            placeholder="Поиск по вашему избранному..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            clearable
            onClear={() => setSearchQuery('')}
          />
        </div>
      </div>

      <div className="favorites-page-artist-section">
        <div className="favorites-page-all-tracks-action">
          <h2>Список всех треков</h2>
          <button onClick={() => navigate(-1)}>&lt; Назад</button>
        </div>

        {loading ? (
          <p className="favorites-page-empty-text">Загрузка треков...</p>
        ) : filteredTracks.length === 0 ? (
          <p className="favorites-page-empty-text">
            {searchQuery ? 'Треки по запросу не найдены' : 'Список избранного пуст'}
          </p>
        ) : (
          <div className="favorites-page-album-tracks-container">
            {filteredTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                index={idx}
                track={track}
                isFavorite={true}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onPlay={() => playTrack(track, filteredTracks)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
