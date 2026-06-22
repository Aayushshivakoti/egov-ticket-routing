"""add verification flag

Revision ID: a3a3a3a3a3a3
Revises: a2a2a2a2a2a2
Create Date: 2026-06-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3a3a3a3a3a3'
down_revision: Union[str, None] = 'a2a2a2a2a2a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add needs_verification with default value of False (0/false)
    op.add_column('tickets', sa.Column('needs_verification', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    op.drop_column('tickets', 'needs_verification')
