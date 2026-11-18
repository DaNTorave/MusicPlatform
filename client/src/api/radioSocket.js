import { Socket } from 'phoenix';
import { apiClient } from './apiClient';

class RadioSocketService {
  constructor() {
    this.socket = null;
    this.channel = null;
    this.onQueueReplaced = null;
  }

  connect() {
    const token = apiClient.getToken();
    const user = apiClient.getUser();
    if (!token || !user?.id) return Promise.reject(new Error('Требуется авторизация'));

    if (this.channel && this.channel.state === 'joined') {
      return Promise.resolve(this.channel);
    }

    return new Promise((resolve, reject) => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/socket`;

      this.socket = new Socket(wsUrl, {
        params: { token },
      });

      this.socket.connect();

      this.channel = this.socket.channel(`radio:${user.id}`, {});

      this.channel.on('queue_replaced', (payload) => {
        if (typeof this.onQueueReplaced === 'function' && Array.isArray(payload?.tracks)) {
          this.onQueueReplaced(payload.tracks);
        }
      });

      this.channel
        .join()
        .receive('ok', () => resolve(this.channel))
        .receive('error', (err) => reject(err));
    });
  }

  async startRadio(genre = null) {
    const channel = await this.connect();
    return new Promise((resolve, reject) => {
      channel
        .push('start_radio', { genre })
        .receive('ok', (res) => resolve(res.tracks || []))
        .receive('error', (err) => reject(err));
    });
  }

  async requestMore() {
    const channel = await this.connect();
    return new Promise((resolve, reject) => {
      channel
        .push('request_more', {})
        .receive('ok', (res) => resolve(res.tracks || []))
        .receive('error', (err) => reject(err));
    });
  }

  sendFeedback(trackId, eventType, listenDurationMs = 0) {
    if (!this.channel || this.channel.state !== 'joined') return;
    this.channel.push('feedback', {
      track_id: trackId,
      event_type: eventType,
      listen_duration_ms: Math.round(listenDurationMs),
    });
  }

  disconnect() {
    if (this.channel) {
      this.channel.leave();
      this.channel = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const radioSocket = new RadioSocketService();