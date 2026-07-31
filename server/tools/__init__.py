from server.tools.registry import ToolRegistry
from server.tools.walmart import register_walmart_tools

__all__ = ["ToolRegistry", "register_walmart_tools", "get_tools"]


def get_tools() -> ToolRegistry:
    """Build and return the full tool registry."""
    registry = ToolRegistry()
    register_walmart_tools(registry)
    return registry