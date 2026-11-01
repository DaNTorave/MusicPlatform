# Скрипт наполнения базы данных полным каталогом жанров и поджанров
alias MusicPlatformApi.Repo
alias MusicPlatformApi.Music.Genre

genres_catalog = [
  # ============================================================================
  # РОК
  # ============================================================================
  %{key: "rock", title_ru: "Рок"},
  %{key: "hard-rock", title_ru: "Хард-рок"},
  %{key: "classic-rock", title_ru: "Классический рок"},
  %{key: "alternative-rock", title_ru: "Альтернативный рок"},
  %{key: "indie-rock", title_ru: "Инди-рок"},
  %{key: "progressive-rock", title_ru: "Прогрессивный рок"},
  %{key: "psychedelic-rock", title_ru: "Психоделический рок"},
  %{key: "post-rock", title_ru: "Пост-рок"},
  %{key: "grunge", title_ru: "Гранж"},
  %{key: "garage-rock", title_ru: "Гаражный рок"},
  %{key: "shoegaze", title_ru: "Шугейз"},
  %{key: "glam-rock", title_ru: "Глэм-рок"},
  %{key: "math-rock", title_ru: "Мат-рок"},
  %{key: "art-rock", title_ru: "Арт-рок"},
  %{key: "stoner-rock", title_ru: "Стоунер-рок"},
  %{key: "folk-rock", title_ru: "Фолк-рок"},
  %{key: "pop-rock", title_ru: "Поп-рок"},
  %{key: "post-grunge", title_ru: "Пост-гранж"},
  %{key: "gothic-rock", title_ru: "Готик-рок"},
  %{key: "russian-rock", title_ru: "Русский рок"},

  # ============================================================================
  # ПАНК И ЭМО
  # ============================================================================
  %{key: "punk", title_ru: "Панк"},
  %{key: "punk-rock", title_ru: "Панк-рок"},
  %{key: "pop-punk", title_ru: "Поп-панк"},
  %{key: "post-punk", title_ru: "Пост-панк"},
  %{key: "hardcore-punk", title_ru: "Хардкор-панк"},
  %{key: "post-hardcore", title_ru: "Пост-хардкор"},
  %{key: "emo", title_ru: "Эмо"},
  %{key: "midwest-emo", title_ru: "Мидвест-эмо"},
  %{key: "screamo", title_ru: "Скримо"},
  %{key: "ska-punk", title_ru: "Ска-панк"},
  %{key: "skate-punk", title_ru: "Скейт-панк"},
  %{key: "folk-punk", title_ru: "Фолк-панк"},
  %{key: "crust-punk", title_ru: "Краст-панк"},
  %{key: "grindcore", title_ru: "Грайндкор"},

  # ============================================================================
  # МЕТАЛ
  # ============================================================================
  %{key: "metal", title_ru: "Метал"},
  %{key: "heavy-metal", title_ru: "Хэви-метал"},
  %{key: "thrash-metal", title_ru: "Трэш-метал"},
  %{key: "death-metal", title_ru: "Дэт-метал"},
  %{key: "melodic-death-metal", title_ru: "Мелодик-дэт-метал"},
  %{key: "black-metal", title_ru: "Блэк-метал"},
  %{key: "power-metal", title_ru: "Пауэр-метал"},
  %{key: "doom-metal", title_ru: "Дум-метал"},
  %{key: "symphonic-metal", title_ru: "Симфоник-метал"},
  %{key: "nu-metal", title_ru: "Ню-метал"},
  %{key: "metalcore", title_ru: "Металкор"},
  %{key: "deathcore", title_ru: "Дэткор"},
  %{key: "mathcore", title_ru: "Маткор"},
  %{key: "groove-metal", title_ru: "Грув-метал"},
  %{key: "industrial-metal", title_ru: "Индастриал-метал"},
  %{key: "progressive-metal", title_ru: "Прогрессив-метал"},
  %{key: "folk-metal", title_ru: "Фолк-метал"},
  %{key: "sludge-metal", title_ru: "Сладж-метал"},
  %{key: "gothic-metal", title_ru: "Готик-метал"},
  %{key: "speed-metal", title_ru: "Спид-метал"},
  %{key: "glam-metal", title_ru: "Глэм-метал"},
  %{key: "djent", title_ru: "Джент"},
  %{key: "viking-metal", title_ru: "Викинг-метал"},

  # ============================================================================
  # ХИП-ХОП И РЭП
  # ============================================================================
  %{key: "hip-hop", title_ru: "Хип-хоп"},
  %{key: "rap", title_ru: "Рэп"},
  %{key: "trap", title_ru: "Трэп"},
  %{key: "drill", title_ru: "Дрилл"},
  %{key: "uk-drill", title_ru: "UK Дрилл"},
  %{key: "boom-bap", title_ru: "Бум-бэп"},
  %{key: "cloud-rap", title_ru: "Клауд-рэп"},
  %{key: "grime", title_ru: "Грайм"},
  %{key: "phonk", title_ru: "Фонк"},
  %{key: "g-funk", title_ru: "Джи-фанк"},
  %{key: "gangsta-rap", title_ru: "Гангста-рэп"},
  %{key: "east-coast-hip-hop", title_ru: "Ист-кост хип-хоп"},
  %{key: "west-coast-hip-hop", title_ru: "Вест-кост хип-хоп"},
  %{key: "southern-rap", title_ru: "Южный рэп"},
  %{key: "memphis-rap", title_ru: "Мемфис-рэп"},
  %{key: "conscious-hip-hop", title_ru: "Осознанный хип-хоп"},
  %{key: "lo-fi-hip-hop", title_ru: "Лоу-фай хип-хоп"},
  %{key: "rnb-rap", title_ru: "Мелодик-рэп"},
  %{key: "experimental-hip-hop", title_ru: "Экспериментальный хип-хоп"},

  # ============================================================================
  # ПОП-МУЗЫКА
  # ============================================================================
  %{key: "pop", title_ru: "Поп"},
  %{key: "dance-pop", title_ru: "Дэнс-поп"},
  %{key: "electropop", title_ru: "Электропоп"},
  %{key: "synthpop", title_ru: "Синти-поп"},
  %{key: "indie-pop", title_ru: "Инди-поп"},
  %{key: "art-pop", title_ru: "Арт-поп"},
  %{key: "dream-pop", title_ru: "Дрим-поп"},
  %{key: "bedroom-pop", title_ru: "Бедрум-поп"},
  %{key: "hyperpop", title_ru: "Гиперпоп"},
  %{key: "teen-pop", title_ru: "Тин-поп"},
  %{key: "europop", title_ru: "Европоп"},
  %{key: "k-pop", title_ru: "Кей-поп"},
  %{key: "j-pop", title_ru: "Джей-поп"},
  %{key: "city-pop", title_ru: "Сити-поп"},
  %{key: "chanson", title_ru: "Шансон"},
  %{key: "disco-polo", title_ru: "Диско-поло"},

  # ============================================================================
  # ЭЛЕКТРОННАЯ МУЗЫКА
  # ============================================================================
  %{key: "electronic", title_ru: "Электронная музыка"},
  %{key: "edm", title_ru: "EDM"},
  %{key: "house", title_ru: "Хаус"},
  %{key: "deep-house", title_ru: "Дип-хаус"},
  %{key: "tech-house", title_ru: "Тек-хаус"},
  %{key: "progressive-house", title_ru: "Прогрессив-хаус"},
  %{key: "electro-house", title_ru: "Электро-хаус"},
  %{key: "future-house", title_ru: "Фьюче-хаус"},
  %{key: "afro-house", title_ru: "Афро-хаус"},
  %{key: "techno", title_ru: "Техно"},
  %{key: "melodic-techno", title_ru: "Мелодик-техно"},
  %{key: "hard-techno", title_ru: "Хард-техно"},
  %{key: "hardcore-techno", title_ru: "Хардкор-техно"},
  %{key: "drum-and-bass", title_ru: "Драм-н-бэйс"},
  %{key: "liquid-funk", title_ru: "Ликвид-фанк"},
  %{key: "neurofunk", title_ru: "Нейрофанк"},
  %{key: "jungle", title_ru: "Джангл"},
  %{key: "dubstep", title_ru: "Дабстеп"},
  %{key: "trance", title_ru: "Транс"},
  %{key: "psytrance", title_ru: "Пси-транс"},
  %{key: "breakbeat", title_ru: "Брейкбит"},
  %{key: "electro", title_ru: "Электро"},
  %{key: "idm", title_ru: "IDM"},
  %{key: "ambient", title_ru: "Эмбиент"},
  %{key: "dark-ambient", title_ru: "Дарк-эмбиент"},
  %{key: "synthwave", title_ru: "Синтвейв"},
  %{key: "retrowave", title_ru: "Ретровейв"},
  %{key: "vaporwave", title_ru: "Вейпорвейв"},
  %{key: "soviet-wave", title_ru: "Советвейв"},
  %{key: "chillwave", title_ru: "Чиллвейв"},
  %{key: "witch-house", title_ru: "Витч-хаус"},
  %{key: "darkwave", title_ru: "Дарквейв"},
  %{key: "new-wave", title_ru: "Нью-вейв"},
  %{key: "industrial", title_ru: "Индастриал"},
  %{key: "ebm", title_ru: "EBM"},
  %{key: "trip-hop", title_ru: "Трип-хоп"},
  %{key: "glitch-hop", title_ru: "Глитч-хоп"},
  %{key: "future-bass", title_ru: "Фьюче-бэйс"},
  %{key: "downtempo", title_ru: "Даунтемпо"},
  %{key: "hardstyle", title_ru: "Хардстайл"},
  %{key: "garage", title_ru: "Гэридж"},
  %{key: "garage-uk", title_ru: "UK Гэридж"},
  %{key: "chiptune", title_ru: "Чиптюн"},
  %{key: "midtempo", title_ru: "Мидтемпо"},
  %{key: "lo-fi", title_ru: "Лоу-фай"},
  %{key: "lounge", title_ru: "Лаунж"},

  # ============================================================================
  # R&B, СОУЛ И ФАНК
  # ============================================================================
  %{key: "rnb", title_ru: "R&B"},
  %{key: "r-and-b", title_ru: "Ритм-н-блюз"},
  %{key: "contemporary-rnb", title_ru: "Современный R&B"},
  %{key: "soul", title_ru: "Соул"},
  %{key: "neo-soul", title_ru: "Нео-соул"},
  %{key: "funk", title_ru: "Фанк"},
  %{key: "disco", title_ru: "Диско"},
  %{key: "motown", title_ru: "Мотаун"},

  # ============================================================================
  # ДЖАЗ И БЛЮЗ
  # ============================================================================
  %{key: "jazz", title_ru: "Джаз"},
  %{key: "bebop", title_ru: "Бибоп"},
  %{key: "hard-bop", title_ru: "Хард-боп"},
  %{key: "cool-jazz", title_ru: "Кул-джаз"},
  %{key: "smooth-jazz", title_ru: "Смут-джаз"},
  %{key: "fusion", title_ru: "Джаз-фьюжн"},
  %{key: "swing", title_ru: "Свинг"},
  %{key: "free-jazz", title_ru: "Фри-джаз"},
  %{key: "acid-jazz", title_ru: "Эйсид-джаз"},
  %{key: "soul-jazz", title_ru: "Соул-джаз"},
  %{key: "gypsy-jazz", title_ru: "Джаз-мануш"},
  %{key: "blues", title_ru: "Блюз"},
  %{key: "delta-blues", title_ru: "Дельта-блюз"},
  %{key: "chicago-blues", title_ru: "Чикагский блюз"},
  %{key: "blues-rock", title_ru: "Блюз-рок"},
  %{key: "electric-blues", title_ru: "Электро-блюз"},
  %{key: "boogie-woogie", title_ru: "Буги-вуги"},

  # ============================================================================
  # КЛАССИЧЕСКАЯ И АКАДЕМИЧЕСКАЯ МУЗЫКА
  # ============================================================================
  %{key: "classical", title_ru: "Классическая музыка"},
  %{key: "baroque", title_ru: "Барокко"},
  %{key: "romanticism", title_ru: "Романтизм"},
  %{key: "neoclassical", title_ru: "Неоклассика"},
  %{key: "minimalism", title_ru: "Минимализм"},
  %{key: "opera", title_ru: "Опера"},
  %{key: "choral", title_ru: "Хоровая музыка"},
  %{key: "medieval", title_ru: "Средневековая музыка"},

  # ============================================================================
  # РЕГГИ
  # ============================================================================
  %{key: "reggae", title_ru: "Регги"},
  %{key: "dub", title_ru: "Даб"},
  %{key: "dancehall", title_ru: "Дэнсхолл"},
  %{key: "ska", title_ru: "Ска"},

  # ============================================================================
  # КАНТРИ, ФОЛК И ЭТНИЧЕСКАЯ МУЗЫКА
  # ============================================================================
  %{key: "country", title_ru: "Кантри"},
  %{key: "bluegrass", title_ru: "Блюграсс"},
  %{key: "folk", title_ru: "Фолк"},
  %{key: "indie-folk", title_ru: "Инди-фолк"},
  %{key: "celtic", title_ru: "Кельтская музыка"},
  %{key: "slavic-folk", title_ru: "Славянский фолк"},
  %{key: "balkan", title_ru: "Балканская музыка"},
  %{key: "klezmer", title_ru: "Клезмер"},
  %{key: "world-music", title_ru: "Ворлд-мьюзик"},
  %{key: "acoustic", title_ru: "Акустическая музыка"},

  # ============================================================================
  # ЛАТИНОАМЕРИКАНСКАЯ И АФРИКАНСКАЯ МУЗЫКА
  # ============================================================================
  %{key: "latin", title_ru: "Латино"},
  %{key: "reggaeton", title_ru: "Реггетон"},
  %{key: "bossa-nova", title_ru: "Босса-нова"},
  %{key: "salsa", title_ru: "Сальса"},
  %{key: "bachata", title_ru: "Бачата"},
  %{key: "cumbia", title_ru: "Кумбия"},
  %{key: "samba", title_ru: "Самба"},
  %{key: "merengue", title_ru: "Меренге"},
  %{key: "tango", title_ru: "Танго"},
  %{key: "flamenco", title_ru: "Фламенко"},
  %{key: "afrobeats", title_ru: "Афробитс"},
  %{key: "amapiano", title_ru: "Амапиано"},
  %{key: "kizomba", title_ru: "Кизомба"},

  # ============================================================================
  # АВАНГАРД И ЭКСПЕРИМЕНТЫ
  # ============================================================================
  %{key: "experimental", title_ru: "Экспериментальная музыка"},
  %{key: "noise", title_ru: "Нойз"},
  %{key: "drone", title_ru: "Дроун"},

  # ============================================================================
  # ПРИКЛАДНАЯ МУЗЫКА И МЕДИА
  # ============================================================================
  %{key: "soundtrack", title_ru: "Саундтрек"},
  %{key: "cinematic", title_ru: "Киномузыка"},
  %{key: "video-game-music", title_ru: "Музыка из видеоигр"},
  %{key: "meditation", title_ru: "Музыка для медитации"},
  %{key: "spoken-word", title_ru: "Разговорный жанр"},
  %{key: "podcast", title_ru: "Подкаст"},
  %{key: "audiobook", title_ru: "Аудиокнига"},
  %{key: "asmr", title_ru: "АСМР"}
]

inserted_count =
  Enum.reduce(genres_catalog, 0, fn item, acc ->
    case Repo.get_by(Genre, key: item.key) do
      nil ->
        %Genre{}
        |> Genre.changeset(item)
        |> Repo.insert!()
        acc + 1

      _ ->
        acc
    end
  end)

IO.puts("Успешно добавлено новых жанров: #{inserted_count} из #{length(genres_catalog)}")
