"""
Error message templates for the application.
"""

def get_file_locked_message(filepath):
    """
    Returns a message explaining that a file cannot be saved because it's currently open.
    
    Args:
        filepath: The path of the file that failed to save
        
    Returns:
        str: A formatted error message
    """
    return f"""
File Save Error

The file could not be saved because it is currently open in another program.

Please close the file "{filepath}" and try again.
""" 