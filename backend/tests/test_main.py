"""Tests for rd_log_python.main module."""

from rd_log_python.main import main


def test_main_runs() -> None:
    """Test that main() runs without error."""
    main()  # Should print "Hello from rd-log-python!"
