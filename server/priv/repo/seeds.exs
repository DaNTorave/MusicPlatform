alias MusicPlatformApi.{Repo, User, PasswordUtils}

case Repo.get_by(User, login: "owner") do
  nil ->
    peppered_password = PasswordUtils.apply_pepper("owner")
    now = DateTime.utc_now()

    Repo.insert!(%User{
      login: "owner",
      email: "owner@gmail.com",
      nickname: "owner",
      role: "owner",
      status: "approved",
      terms_accepted_at: now,
      privacy_accepted_at: now,
      password_hash: Pbkdf2.hash_pwd_salt(peppered_password)
    })

  _ ->
    :ok
end
