import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import { radioSocket } from '../api/radioSocket';
import { apiClient } from '../api/apiClient';

const AudioContext = createContext(null);

function buildStreamUrl(track) {
  if (!track) return '';
  if (track.streamUrl) return track.streamUrl;
  const token = apiClient.getToken();
  return token
    ? `/api/stream/${track.id}?token=${encodeURIComponent(token)}`
    : `/api/stream/${track.id}`;
}

export const AudioProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(() => {
    try {
      const saved = localStorage.getItem('player_track');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('player_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [radioGenre, setRadioGenre] = useState(null);
  const [volume, setVolume] = useState(() => {
    return parseFloat(localStorage.getItem('player_volume') || '0.8');
  });

  const audioRef = useRef(new Audio());
  const currentSrcRef = useRef('');
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const isRadioModeRef = useRef(isRadioMode);
  isRadioModeRef.current = isRadioMode;

  const completedReportedRef = useRef(false);

  // Подписка на перестройку очереди сервером при скипе или дизлайке
  useEffect(() => {
    radioSocket.onQueueReplaced = (newTracks) => {
      if (!isRadioModeRef.current || !Array.isArray(newTracks) || newTracks.length === 0) return;

      const activeTrack = currentTrackRef.current;
      const updatedQueue = activeTrack ? [activeTrack, ...newTracks] : newTracks;
      setQueue(updatedQueue);
      queueRef.current = updatedQueue;
    };

    return () => {
      radioSocket.onQueueReplaced = null;
    };
  }, []);

  // Инициализация аудио и отслеживание дослушивания (80%)
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = (e) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
    };

    const onTimeUpdate = () => {
      const track = currentTrackRef.current;
      if (!track || completedReportedRef.current) return;

      if (audio.duration > 0 && audio.currentTime / audio.duration >= 0.8) {
        completedReportedRef.current = true;
        radioSocket.sendFeedback(track.id, 'complete', audio.currentTime * 1000);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('timeupdate', onTimeUpdate);

    setIsPlaying(false);

    if (currentTrack?.id && apiClient.getToken()) {
      const targetSrc = buildStreamUrl(currentTrack);
      currentSrcRef.current = targetSrc;
      audio.src = targetSrc;
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  useEffect(() => {
    audioRef.current.volume = volume;
    localStorage.setItem('player_volume', volume.toString());
  }, [volume]);

  // Запуск режима прямого эфира
  const startLiveRadio = async (genre = null) => {
    try {
      const tracks = await radioSocket.startRadio(genre);
      if (tracks.length === 0) {
        alert('В каталоге пока недостаточно одобренных треков для запуска эфира.');
        return;
      }

      setIsRadioMode(true);
      isRadioModeRef.current = true;
      setRadioGenre(genre);

      playInternalTrack(tracks[0], tracks);
    } catch (err) {
      console.error('Ошибка запуска эфира:', err);
      alert('Для запуска персонального эфира необходимо войти в одобренный аккаунт.');
    }
  };

  // Остановка режима эфира (возврат к обычному плееру)
  const stopLiveRadio = () => {
    setIsRadioMode(false);
    isRadioModeRef.current = false;
    setRadioGenre(null);
    radioSocket.disconnect();
  };

  // Переход к следующему треку с отправкой сигнала раннего пропуска
  const nextTrack = async () => {
    const currentQ = queueRef.current;
    const currentT = currentTrackRef.current;
    const audio = audioRef.current;

    if (!currentT) return;

    if (audio && !completedReportedRef.current && audio.currentTime > 0 && audio.currentTime < 30) {
      radioSocket.sendFeedback(currentT.id, 'skip_early', audio.currentTime * 1000);
    }

    const currentIndex = currentQ.findIndex((t) => String(t.id) === String(currentT.id));

    if (currentIndex !== -1 && currentIndex + 1 < currentQ.length) {
      const nextT = currentQ[currentIndex + 1];
      playInternalTrack(nextT, currentQ);

      if (isRadioModeRef.current && currentQ.length - (currentIndex + 1) <= 2) {
        try {
          const moreTracks = await radioSocket.requestMore();
          if (moreTracks.length > 0) {
            const merged = [...queueRef.current.slice(-5), ...moreTracks];
            setQueue(merged);
            queueRef.current = merged;
          }
        } catch (e) {
          console.warn('Не удалось подгрузить продолжение эфира:', e);
        }
      }
    } else if (isRadioModeRef.current) {
      try {
        const moreTracks = await radioSocket.requestMore();
        if (moreTracks.length > 0) {
          playInternalTrack(moreTracks[0], moreTracks);
        }
      } catch (e) {
        console.warn('Ошибка получения следующего трека эфира:', e);
      }
    }
  };

  // Дизлайк текущего трека в эфире
  const dislikeCurrentTrack = async () => {
    const currentT = currentTrackRef.current;
    const audio = audioRef.current;
    if (!currentT) return;

    completedReportedRef.current = true;
    radioSocket.sendFeedback(currentT.id, 'dislike', (audio?.currentTime || 0) * 1000);

    if (isRadioModeRef.current) {
      try {
        const moreTracks = await radioSocket.requestMore();
        if (moreTracks.length > 0) {
          playInternalTrack(moreTracks[0], moreTracks);
          return;
        }
      } catch (e) {
        console.warn('Ошибка обновления эфира после дизлайка:', e);
      }
    }

    nextTrack();
  };

  const prevTrack = () => {
    const currentQ = queueRef.current;
    const currentT = currentTrackRef.current;
    if (!currentQ || currentQ.length === 0 || !currentT) return;

    const currentIndex = currentQ.findIndex((t) => String(t.id) === String(currentT.id));
    if (currentIndex > 0) {
      const prevT = currentQ[currentIndex - 1];
      playInternalTrack(prevT, currentQ);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => {
      nextTrack();
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const playInternalTrack = (track, newQueue = null) => {
    if (!track || !track.id) return;
    const audio = audioRef.current;
    completedReportedRef.current = false;

    if (newQueue && Array.isArray(newQueue)) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      try {
        localStorage.setItem('player_queue', JSON.stringify(newQueue));
      } catch (e) {
        console.warn('Queue storage error:', e);
      }
    }

    const targetSrc = buildStreamUrl(track);
    setCurrentTrack(track);
    currentTrackRef.current = track;

    if (!track.streamUrl) {
      try {
        localStorage.setItem('player_track', JSON.stringify(track));
      } catch (e) {
        console.warn('Track storage error:', e);
      }
    }

    currentSrcRef.current = targetSrc;
    audio.src = targetSrc;
    audio.currentTime = 0;

    radioSocket.sendFeedback(track.id, 'play_start', 0);

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.warn('Playback error:', err);
        setIsPlaying(false);
      });
  };

  const playTrack = (track, newQueue = null) => {
    if (!track || !track.id) return;
    const audio = audioRef.current;
    const targetSrc = buildStreamUrl(track);
    const isSameTrack = currentTrack && String(currentTrack.id) === String(track.id);

    if (isSameTrack && !track.streamUrl) {
      if (!audio.src || currentSrcRef.current !== targetSrc) {
        audio.src = targetSrc;
        currentSrcRef.current = targetSrc;
      }

      if (!audio.paused && isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(() => setIsPlaying(false));
      }
      return;
    }

    if (isRadioModeRef.current) {
      stopLiveRadio();
    }

    playInternalTrack(track, newQueue);
  };

  const updateTrackTitle = (newTitle) => {
    setCurrentTrack((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, title: newTitle };
      if (!prev.streamUrl) {
        localStorage.setItem('player_track', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const updateTrackCover = (newCover) => {
    setCurrentTrack((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, cover: newCover };
      if (!prev.streamUrl) {
        localStorage.setItem('player_track', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const stopPlayer = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    stopLiveRadio();
    currentSrcRef.current = '';
    setIsPlaying(false);
    setCurrentTrack(null);
    setQueue([]);
    localStorage.removeItem('player_track');
    localStorage.removeItem('player_queue');
  };

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        isRadioMode,
        radioGenre,
        volume,
        setVolume,
        playTrack,
        startLiveRadio,
        stopLiveRadio,
        dislikeCurrentTrack,
        nextTrack,
        prevTrack,
        updateTrackTitle,
        updateTrackCover,
        stopPlayer,
        audioRef,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => useContext(AudioContext);