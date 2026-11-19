defmodule MusicPlatformApi.Token do
  # Получение секретного ключа в рантайме
  defp secret_key do
    System.get_env("SECRET_TOKEN") ||
      Application.get_env(:music_platform_api, MusicPlatformApiWeb.Endpoint)[:secret_key_base] ||
      raise "SECRET_TOKEN или secret_key_base не настроены"
  end

  # Генерация токена
  def generate_token(claims) do
    try do
      claims_with_defaults =
        Map.merge(
          %{
            "iat" => System.system_time(:second),
            "exp" => System.system_time(:second) + 86400,
            "user_id" => nil
          },
          claims
        )

      clean_claims =
        claims_with_defaults
        |> Enum.filter(fn {_key, value} -> not is_nil(value) end)
        |> Map.new()

      if not Map.has_key?(clean_claims, "user_id") do
        raise "user_id is missing in claims"
      end

      header = %{"alg" => "HS256", "typ" => "JWT"}
      header_encoded = header |> Jason.encode!() |> base64url_encode()
      claims_encoded = clean_claims |> Jason.encode!() |> base64url_encode()

      signature_data = header_encoded <> "." <> claims_encoded
      signature = :crypto.mac(:hmac, :sha256, secret_key(), signature_data) |> base64url_encode()

      token = header_encoded <> "." <> claims_encoded <> "." <> signature
      {:ok, token, clean_claims}
    rescue
      error ->
        {:error, "Не удалось сгенерировать токен: #{inspect(error)}"}
    end
  end

  # Проверка валидности и срока действия токена
  def verify_token(token) when is_binary(token) do
    try do
      case String.split(token, ".") do
        [header_encoded, claims_encoded, signature_encoded] ->
          signature_data = header_encoded <> "." <> claims_encoded
          expected_signature = :crypto.mac(:hmac, :sha256, secret_key(), signature_data) |> base64url_encode()

          if Plug.Crypto.secure_compare(signature_encoded, expected_signature) do
            claims = claims_encoded |> base64url_decode() |> Jason.decode!()

            case claims do
              %{"exp" => exp} when is_integer(exp) ->
                if exp < System.system_time(:second) do
                  {:error, "Срок действия токена истек"}
                else
                  {:ok, claims}
                end

              _ ->
                {:error, "В токене отсутствует срок действия"}
            end
          else
            {:error, "Неверная подпись токена"}
          end

        _ ->
          {:error, "Неверный формат токена"}
      end
    rescue
      _error ->
        {:error, "Недействительный токен"}
    end
  end

  def verify_token(_), do: {:error, "Неверный формат токена"}

  defp base64url_encode(data) do
    Base.url_encode64(data, padding: false)
  end

  defp base64url_decode(data) do
    Base.url_decode64!(data, padding: false)
  end
end
