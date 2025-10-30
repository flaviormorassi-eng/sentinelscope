import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Threat } from '@shared/schema';
import { format } from 'date-fns';

export function generatePDFReport(threats: Threat[], type: string, period: string): Buffer {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('SentinelScope Security Report', 20, 20);

  // Metadata
  doc.setFontSize(10);
  doc.text(`Report Type: ${type}`, 20, 30);
  doc.text(`Period: ${period}`, 20, 35);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 20, 40);

  // Summary statistics
  doc.setFontSize(12);
  doc.text('Executive Summary', 20, 50);
  doc.setFontSize(10);
  doc.text(`Total Threats Detected: ${threats.length}`, 20, 57);
  doc.text(`Critical Threats: ${threats.filter(t => t.severity === 'critical').length}`, 20, 62);
  doc.text(`Threats Blocked: ${threats.filter(t => t.blocked).length}`, 20, 67);

  // Threats table
  const tableData = threats.slice(0, 50).map(t => [
    format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm'),
    t.severity,
    t.type,
    t.sourceIP,
    t.targetIP,
    t.status,
  ]);

  autoTable(doc, {
    head: [['Timestamp', 'Severity', 'Type', 'Source IP', 'Target IP', 'Status']],
    body: tableData,
    startY: 75,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 133, 244] },
  });

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

export function generateCSVReport(threats: Threat[]): string {
  const headers = ['Timestamp', 'Severity', 'Type', 'Source IP', 'Source Country', 'Target IP', 'Status', 'Description'];
  const rows = threats.map(t => [
    format(new Date(t.timestamp), 'yyyy-MM-dd HH:mm:ss'),
    t.severity,
    t.type,
    t.sourceIP,
    t.sourceCountry || '',
    t.targetIP,
    t.status,
    t.description,
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export function generateJSONReport(threats: Threat[], type: string, period: string): string {
  const report = {
    metadata: {
      reportType: type,
      period,
      generatedAt: new Date().toISOString(),
      totalThreats: threats.length,
    },
    summary: {
      critical: threats.filter(t => t.severity === 'critical').length,
      high: threats.filter(t => t.severity === 'high').length,
      medium: threats.filter(t => t.severity === 'medium').length,
      low: threats.filter(t => t.severity === 'low').length,
      blocked: threats.filter(t => t.blocked).length,
    },
    threats: threats.map(t => ({
      timestamp: t.timestamp,
      severity: t.severity,
      type: t.type,
      sourceIP: t.sourceIP,
      sourceLocation: `${t.sourceCity}, ${t.sourceCountry}`,
      targetIP: t.targetIP,
      status: t.status,
      description: t.description,
      blocked: t.blocked,
    })),
  };

  return JSON.stringify(report, null, 2);
}
