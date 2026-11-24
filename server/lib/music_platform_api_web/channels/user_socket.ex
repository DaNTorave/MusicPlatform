defmodule MusicPlatformApiWeb.UserSocket do
  use Phoenix.Socket
  alias MusicPlatformApi.Auth

  channel "radio:*", MusicPlatformApiWeb.RadioChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Auth.get_user_from_token(token) do
      user when not is_nil(user) ->
        if Auth.approved?(user) do
          {:ok, assign(socket, :user_id, user.id)}
        else
          :error
        end

      _ ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
