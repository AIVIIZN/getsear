'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ReceiptPreview,
  getSampleReceiptData,
} from './ReceiptPreview';
import type { ReceiptConfig } from '@/lib/printing/printer-interface';

interface ReceiptConfigFormProps {
  locationId: string;
}

export function ReceiptConfigForm({ locationId }: ReceiptConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  // Form state
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('Thank you for dining with us!');
  const [showDualPricing, setShowDualPricing] = useState(true);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Location data for preview
  const [locationName, setLocationName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      // Fetch receipt config
      const configRes = await fetch(
        `/api/printing/receipt-config?location_id=${locationId}`
      );
      if (configRes.ok) {
        const configJson = await configRes.json();
        if (configJson.data) {
          const cfg = configJson.data as ReceiptConfig;
          setConfigId(cfg.id);
          setHeaderText(cfg.header_text);
          setFooterText(cfg.footer_text);
          setShowDualPricing(cfg.show_dual_pricing);
          setShowQrCode(cfg.show_qr_code);
          setQrCodeUrl(cfg.qr_code_url ?? '');
        }
      }

      // Fetch location info for header
      const locRes = await fetch(`/api/settings/locations/${locationId}`);
      if (locRes.ok) {
        const locJson = await locRes.json();
        const loc = locJson.data;
        if (loc) {
          setLocationName(loc.name ?? '');
          setAddressLine1(loc.address_line1 ?? '');
          setAddressLine2(loc.address_line2 ?? '');
          setCity(loc.city ?? '');
          setState(loc.state ?? '');
          setZip(loc.zip ?? '');
          setPhone(loc.phone ?? '');
        }
      }
    } catch {
      toast.error('Failed to load receipt configuration');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        location_id: locationId,
        header_text: headerText,
        footer_text: footerText,
        show_dual_pricing: showDualPricing,
        show_qr_code: showQrCode,
        qr_code_url: qrCodeUrl || null,
      };

      const method = configId ? 'PATCH' : 'POST';
      const url = configId
        ? `/api/printing/receipt-config/${configId}`
        : '/api/printing/receipt-config';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      const json = await res.json();
      if (json.data?.id) setConfigId(json.data.id);

      toast.success('Receipt configuration saved');
    } catch {
      toast.error('Failed to save receipt configuration');
    } finally {
      setSaving(false);
    }
  }

  // Build preview config
  const previewConfig: ReceiptConfig = {
    id: configId ?? '',
    org_id: '',
    location_id: locationId,
    header_text: headerText,
    footer_text: footerText,
    logo_path: null,
    show_dual_pricing: showDualPricing,
    show_qr_code: showQrCode,
    qr_code_url: qrCodeUrl || null,
    created_at: '',
    updated_at: '',
  };

  const sampleData = getSampleReceiptData();
  const previewLocation = {
    name: locationName || sampleData.location.name,
    address_line1: addressLine1 || sampleData.location.address_line1,
    address_line2: addressLine2 || sampleData.location.address_line2,
    city: city || sampleData.location.city,
    state: state || sampleData.location.state,
    zip: zip || sampleData.location.zip,
    phone: phone || sampleData.location.phone,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form */}
      <div className="space-y-6">
        <Card className="shadow-warm-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Receipt Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="header-text">Header Text</Label>
              <Textarea
                id="header-text"
                placeholder="Additional text below address (e.g., 'Est. 2020')"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Appears below the restaurant name and address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer-text">Footer Text</Label>
              <Textarea
                id="footer-text"
                placeholder="Thank you for dining with us!"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Appears at the bottom of every receipt.
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="dual-pricing">Dual Pricing</Label>
                <p className="text-xs text-muted-foreground">
                  Show both card and cash prices on receipt.
                </p>
              </div>
              <Switch
                id="dual-pricing"
                checked={showDualPricing}
                onCheckedChange={setShowDualPricing}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="qr-code">QR Code</Label>
                <p className="text-xs text-muted-foreground">
                  Print a QR code at the bottom of receipts.
                </p>
              </div>
              <Switch
                id="qr-code"
                checked={showQrCode}
                onCheckedChange={setShowQrCode}
              />
            </div>

            {showQrCode && (
              <div className="space-y-2">
                <Label htmlFor="qr-url">QR Code URL</Label>
                <Input
                  id="qr-url"
                  type="url"
                  placeholder="https://yourrestaurant.com/feedback"
                  value={qrCodeUrl}
                  onChange={(e) => setQrCodeUrl(e.target.value)}
                  className="h-11"
                />
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 gap-2 btn-press touch-target w-full"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Receipt Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live Preview */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Live Preview
        </h3>
        <ReceiptPreview
          order={sampleData.order}
          location={previewLocation}
          config={previewConfig}
        />
      </div>
    </div>
  );
}
