from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.api.auth_utils import get_current_user
from app.models import User, Department, Ticket
from app.telemetry import calculate_telemetry

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only central supervisors can access system telemetry logs."
        )
    return calculate_telemetry(db)

@router.get("/csat")
def get_csat_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only central supervisors can access CSAT metrics."
        )
        
    departments = db.query(Department).all()
    result = []
    
    for dept in departments:
        # Get resolved tickets with citizen feedback
        resolved_tickets = db.query(Ticket).filter(
            Ticket.assigned_department_id == dept.id,
            Ticket.status == "resolved",
            Ticket.citizen_satisfied != None
        ).all()
        
        total = len(resolved_tickets)
        satisfied = sum(1 for t in resolved_tickets if t.citizen_satisfied is True)
        unsatisfied = sum(1 for t in resolved_tickets if t.citizen_satisfied is False)
        
        csat_score = round((satisfied / total) * 100, 1) if total > 0 else 0.0
        
        result.append({
            "department_id": dept.id,
            "department_name": dept.name,
            "total_feedback": total,
            "satisfied": satisfied,
            "unsatisfied": unsatisfied,
            "csat_score": csat_score
        })
        
    return result

@router.get("/export-pdf")
def export_pdf_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only central supervisors can export PDF reports."
        )
    
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    import datetime

    # Gather data
    departments = db.query(Department).all()
    
    # PDF document setup in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#0f172a'),  # Dark Slate
        spaceAfter=15,
        alignment=1 # Center
    )
    
    meta_style = ParagraphStyle(
        'DocMeta',
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#475569'),
        spaceAfter=25,
        alignment=1
    )
    
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=10,
        spaceBefore=15
    )
    
    cell_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#334155')
    )
    
    cell_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white
    )

    # Document Header
    story.append(Paragraph("E-GOVERNANCE GRIEVANCE PORTAL", title_style))
    story.append(Paragraph(
        f"Central Supervisor Executive Summary • Generated: {datetime.datetime.now().strftime('%Y-%b-%d %H:%M:%S')} • Nepal Government",
        meta_style
    ))
    
    # Overall System Stats Summary
    total_tickets = db.query(Ticket).count()
    pending_tickets = db.query(Ticket).filter(Ticket.status.in_(["pending", "processing"])).count()
    in_progress_tickets = db.query(Ticket).filter(Ticket.status == "in_progress").count()
    resolved_tickets = db.query(Ticket).filter(Ticket.status == "resolved").count()
    sla_violations = db.query(Ticket).filter(Ticket.sla_violated == True).count()
    
    stats_data = [
        [
            Paragraph("Total Tickets", cell_header_style),
            Paragraph("Pending Assign", cell_header_style),
            Paragraph("In Progress", cell_header_style),
            Paragraph("Resolved", cell_header_style),
            Paragraph("SLA Breaches", cell_header_style)
        ],
        [
            Paragraph(str(total_tickets), cell_style),
            Paragraph(str(pending_tickets), cell_style),
            Paragraph(str(in_progress_tickets), cell_style),
            Paragraph(str(resolved_tickets), cell_style),
            Paragraph(str(sla_violations), cell_style)
        ]
    ]
    
    stats_table = Table(stats_data, colWidths=[100]*5)
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3b82f6')),  # Blue brand
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#f8fafc')),
    ]))
    
    story.append(Paragraph("System-Wide Statistics Overview", heading_style))
    story.append(stats_table)
    story.append(Spacer(1, 20))
    
    # Department Breakdown Table
    story.append(Paragraph("Department Performance & CSAT Breakdown", heading_style))
    
    dept_table_data = [
        [
            Paragraph("Department Name", cell_header_style),
            Paragraph("Total", cell_header_style),
            Paragraph("Pending", cell_header_style),
            Paragraph("In Progress", cell_header_style),
            Paragraph("Resolved", cell_header_style),
            Paragraph("SLA Violated", cell_header_style),
            Paragraph("CSAT Score", cell_header_style)
        ]
    ]
    
    for dept in departments:
        d_total = db.query(Ticket).filter(Ticket.assigned_department_id == dept.id).count()
        d_pending = db.query(Ticket).filter(Ticket.assigned_department_id == dept.id, Ticket.status.in_(["pending", "processing"])).count()
        d_progress = db.query(Ticket).filter(Ticket.assigned_department_id == dept.id, Ticket.status == "in_progress").count()
        d_resolved = db.query(Ticket).filter(Ticket.assigned_department_id == dept.id, Ticket.status == "resolved").count()
        d_sla = db.query(Ticket).filter(Ticket.assigned_department_id == dept.id, Ticket.sla_violated == True).count()
        
        # Calculate CSAT score
        res_fb = db.query(Ticket).filter(
            Ticket.assigned_department_id == dept.id,
            Ticket.status == "resolved",
            Ticket.citizen_satisfied != None
        ).all()
        fb_total = len(res_fb)
        fb_satisfied = sum(1 for t in res_fb if t.citizen_satisfied is True)
        csat_score = f"{round((fb_satisfied / fb_total) * 100, 1)}%" if fb_total > 0 else "N/A"
        
        dept_table_data.append([
            Paragraph(dept.name, cell_style),
            Paragraph(str(d_total), cell_style),
            Paragraph(str(d_pending), cell_style),
            Paragraph(str(d_progress), cell_style),
            Paragraph(str(d_resolved), cell_style),
            Paragraph(str(d_sla), cell_style),
            Paragraph(csat_score, cell_style)
        ])
        
    dept_table = Table(dept_table_data, colWidths=[170, 50, 55, 65, 55, 75, 70])
    dept_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),  # Dark Slate
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    story.append(dept_table)
    
    # Build Document
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=egov_grievance_summary.pdf"}
    )
