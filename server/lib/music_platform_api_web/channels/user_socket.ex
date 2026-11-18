defmodule MusicPlatformApiWeb.UserSocket do
  use Phoenix.Socket
  alias MusicPlatformApi.Token

  channel "radio:*", MusicPlatformApiWeb.RadioChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Token.verify_token(token) do
      {:ok, %{"user_id" => user_id}} ->
        {:ok, assign(socket, :user_id, user_id)}

      _ ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
