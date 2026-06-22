"""add_processing_status

Revision ID: 73358b92bffc
Revises: a3a3a3a3a3a3
Create Date: 2026-06-22 17:51:41.466598

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73358b92bffc'
down_revision: Union[str, None] = 'a3a3a3a3a3a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        # Dropping check constraints in SQLite batch mode drops them from table definition
        batch_op.drop_constraint('check_ticket_status', type_='check')
        batch_op.create_check_constraint(
            'check_ticket_status',
            "status IN ('processing', 'pending', 'in_progress', 'resolved')"
        )


def downgrade() -> None:
    with op.batch_alter_table('tickets', schema=None) as batch_op:
        batch_op.drop_constraint('check_ticket_status', type_='check')
        batch_op.create_check_constraint(
            'check_ticket_status',
            "status IN ('pending', 'in_progress', 'resolved')"
        )
