"""add remarks to tickets

Revision ID: a2a2a2a2a2a2
Revises: a1a1a1a1a1a1
Create Date: 2026-06-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2a2a2a2a2a2'
down_revision: Union[str, None] = 'a1a1a1a1a1a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('remarks', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tickets', 'remarks')
