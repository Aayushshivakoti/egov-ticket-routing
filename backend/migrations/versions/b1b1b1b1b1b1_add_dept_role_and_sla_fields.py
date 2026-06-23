"""add_dept_role_and_sla_fields

Revision ID: b1b1b1b1b1b1
Revises: e487c5b7bdc8
Create Date: 2026-06-22 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1b1b1b1b1b1'
down_revision: Union[str, None] = 'e487c5b7bdc8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add dept_role to users table
    op.add_column('users', sa.Column('dept_role', sa.String(length=30), nullable=True))
    
    # Add SLA fields to tickets table
    op.add_column('tickets', sa.Column('proof_requested_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tickets', sa.Column('sla_violated', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('tickets', 'sla_violated')
    op.drop_column('tickets', 'proof_requested_at')
    op.drop_column('users', 'dept_role')
