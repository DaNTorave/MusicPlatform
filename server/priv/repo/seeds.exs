# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     MusicPlatformApi.Repo.insert!(%MusicPlatformApi.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias MusicPlatformApi.{Repo, User, PasswordUtils}

case Repo.get_by(User, login: "owner") do
  nil ->
    peppered_password = PasswordUtils.apply_pepper("owner")

    Repo.insert!(%User{
      login: "owner",
      email: "owner@gmail.com",
      nickname: "owner",
      role: "owner",
      password_hash: Pbkdf2.hash_pwd_salt(peppered_password)
    })

  _ ->
    :ok
end
