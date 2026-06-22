"""add_is_proof_to_attachments

Revision ID: 6303ce72a6dc
Revises: ffff393ef87a
Create Date: 2026-06-22 20:46:45.718427

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6303ce72a6dc'
down_revision: Union[str, None] = 'ffff393ef87a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ticket_attachments', sa.Column('is_proof', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('ticket_attachments', 'is_proof')
