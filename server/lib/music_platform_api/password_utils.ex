defmodule MusicPlatformApi.PasswordUtils do
  def strong_password?(password) do
    String.length(password) >= 8 and
      String.match?(password, ~r/[a-z]/) and
      String.match?(password, ~r/[A-Z]/) and
      String.match?(password, ~r/[0-9]/) and
      String.match?(password, ~r/[^a-zA-Z0-9]/)
  end

  def generate_temporary_password(length \\ 12) do
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-="

    Enum.reduce(1..length, "", fn _, acc ->
      acc <> String.at(chars, :rand.uniform(String.length(chars)) - 1)
    end)
  end

  # Смешивание пароля с серверным перцем через HMAC-SHA256
  def apply_pepper(password) when is_binary(password) do
    pepper = get_pepper()

    :crypto.mac(:hmac, :sha256, pepper, password)
    |> Base.encode64()
  end

  defp get_pepper do
    case System.get_env("PASSWORD_PEPPER") do
      val when is_binary(val) and byte_size(val) >= 16 ->
        val

      _ ->
        if Application.get_env(:music_platform_api, :dev_routes) do
          "dev-local-pepper-secret-key-change-in-prod"
        else
          raise "Переменная окружения PASSWORD_PEPPER не задана или короче 16 символов"
        end
    end
  end
end
