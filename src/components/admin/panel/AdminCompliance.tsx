import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, Shield, CheckCircle, Globe, Receipt, Calculator, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminCompliance() {
  const [generating, setGenerating] = useState(false);

  const handleExport = (type: string) => {
    setGenerating(true);
    setTimeout(() => {
      toast.success(`${type} report generated`);
      setGenerating(false);
    }, 1500);
  };

  const complianceChecks = [
    { area: 'GDPR', status: 'compliant', lastAudit: '2026-02-01', details: 'Data processing agreement, consent tracking, right to erasure' },
    { area: 'Google Play Billing', status: 'compliant', lastAudit: '2026-01-28', details: 'No external payment links in Android, Play Billing API integrated' },
    { area: 'Data Retention', status: 'compliant', lastAudit: '2026-01-20', details: '365-day retention, auto-purge enabled' },
    { area: 'Tax Compliance (VAT)', status: 'review', lastAudit: '2026-01-15', details: 'EU VAT MOSS registration pending' },
    { area: 'Content Moderation', status: 'compliant', lastAudit: '2026-02-05', details: 'User content reviewed, abuse reporting active' },
    { area: 'Accessibility (WCAG)', status: 'partial', lastAudit: '2026-01-10', details: 'AA compliance for core features' },
  ];

  const taxRegions = [
    { region: 'Bangladesh', rate: '15% VAT', status: 'active', collected: '$120' },
    { region: 'European Union', rate: 'Variable VAT', status: 'pending', collected: '$0' },
    { region: 'United States', rate: 'State sales tax', status: 'via Play Store', collected: 'N/A' },
    { region: 'UAE', rate: '5% VAT', status: 'active', collected: '$45' },
  ];

  const invoices = [
    { id: 'INV-2026-001', user: 'user_a8f3...', amount: '$49.99', date: '2026-02-01', status: 'paid' },
    { id: 'INV-2026-002', user: 'user_c2d1...', amount: '$4.99', date: '2026-02-03', status: 'paid' },
    { id: 'INV-2026-003', user: 'user_f7e2...', amount: '$29.99', date: '2026-02-05', status: 'pending' },
  ];

  return (
    <div className="space-y-6">
      {/* Compliance Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Compliance Score', value: '92%', icon: Shield, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Last Audit', value: 'Feb 5', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Tax Regions', value: '4', icon: Globe, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Open Issues', value: '2', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Compliance Status</CardTitle>
          <CardDescription>Regulatory and policy compliance checks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {complianceChecks.map(check => (
              <div key={check.area} className={`p-4 rounded-lg border ${
                check.status === 'compliant' ? 'border-green-500/30 bg-green-500/5' :
                check.status === 'review' ? 'border-amber-500/30 bg-amber-500/5' :
                'border-blue-500/30 bg-blue-500/5'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`h-5 w-5 ${
                      check.status === 'compliant' ? 'text-green-500' :
                      check.status === 'review' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div>
                      <p className="font-medium">{check.area}</p>
                      <p className="text-xs text-muted-foreground">{check.details}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={check.status === 'compliant' ? 'default' : 'secondary'} className={
                      check.status === 'compliant' ? 'bg-green-500' : ''
                    }>
                      {check.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Audited: {check.lastAudit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tax & VAT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Tax & VAT</CardTitle>
            <CardDescription>Regional tax configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRegions.map(r => (
                  <TableRow key={r.region}>
                    <TableCell className="font-medium">{r.region}</TableCell>
                    <TableCell>{r.rate}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{r.collected}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Invoices</CardTitle>
              <CardDescription>Recent invoice activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleExport('Invoice')} disabled={generating}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                    <TableCell className="font-medium">{inv.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.date}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>{inv.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Export Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Legal & Audit Reports</CardTitle>
          <CardDescription>Generate compliance-ready documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Payment History', desc: 'Full transaction log' },
              { label: 'User Data Report', desc: 'GDPR data export' },
              { label: 'Tax Summary', desc: 'VAT/GST breakdown' },
              { label: 'Audit Trail', desc: 'Admin action log' },
            ].map(report => (
              <Button key={report.label} variant="outline" className="h-auto py-4 flex-col" onClick={() => handleExport(report.label)} disabled={generating}>
                <Download className="h-5 w-5 mb-2" />
                <span className="text-sm font-medium">{report.label}</span>
                <span className="text-xs text-muted-foreground">{report.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
