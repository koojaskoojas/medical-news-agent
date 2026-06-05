import sys
import os
from loguru import logger

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=LOG_LEVEL,
    colorize=True,
)
logger.add(
    "logs/app.log",
    rotation="1 day",
    retention="7 days",
    level="DEBUG",
    encoding="utf-8",
)
