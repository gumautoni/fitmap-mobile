from sqlalchemy import URL, Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from fitmap.config import Settings, get_settings


def build_database_url(settings: Settings) -> URL:
    return URL.create(
        drivername="postgresql+psycopg",
        username=settings.db_user,
        password=settings.db_password.get_secret_value(),
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
    )


_settings = get_settings()

engine: Engine = create_engine(
    build_database_url(_settings),
    pool_pre_ping=True,
)

session_factory = sessionmaker(
    bind=engine,
    class_=Session,
    expire_on_commit=False,
)


def check_database_connection() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
