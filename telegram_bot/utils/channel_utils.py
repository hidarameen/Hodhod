"""Channel utilities for ID normalization"""

def normalize_channel_id(channel_id: str | int) -> int | str:
    """
    Convert channel ID to proper Pyrogram format.
    Telegram private channel IDs must start with -100.
    Works with both bot mode and userbot mode.
    """
    try:
        # Try to convert to int
        id_int = int(channel_id)
        
        # If it's a small positive number (1-999), it's likely a database ID
        # Convert to proper Telegram private channel ID format: -100XXXXX
        if 0 < id_int < 10000:
            return -100 * 1000000 + id_int
        
        # If it's already a large negative number, return as is
        if id_int < 0:
            return id_int
        
        # If it's a large positive number, assume it's already correct
        return id_int
    except (ValueError, TypeError):
        # Return as string (username or link)
        return str(channel_id)
