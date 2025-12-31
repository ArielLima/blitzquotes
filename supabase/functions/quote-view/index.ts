import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PaymentConfig {
  label: string;
  buildUrl: (link: string, amount: number) => string | null;
}

const PAYMENT_METHODS: Record<string, PaymentConfig> = {
  stripe: {
    label: 'Pay with Card',
    buildUrl: (link) => link,
  },
  venmo: {
    label: 'Pay with Venmo',
    buildUrl: (link, amount) => {
      const username = link.replace('@', '');
      // Use web URL that works in browsers - deep link only works in mobile apps
      return `https://venmo.com/u/${username}`;
    },
  },
  paypal: {
    label: 'Pay with PayPal',
    buildUrl: (link, amount) => {
      const baseUrl = link.endsWith('/') ? link : `${link}/`;
      return `${baseUrl}${amount}`;
    },
  },
  cashapp: {
    label: 'Pay with Cash App',
    buildUrl: (link, amount) => {
      const cashtag = link.replace('$', '');
      return `https://cash.app/$${cashtag}/${amount}`;
    },
  },
  square: {
    label: 'Pay with Square',
    buildUrl: (link) => link,
  },
  zelle: {
    label: 'Pay with Zelle',
    buildUrl: () => null,
  },
  none: {
    label: '',
    buildUrl: () => null,
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Support both query param (?id=xxx) and path param (/quote-view/xxx)
  let quoteId = url.searchParams.get('id');
  if (!quoteId) {
    const pathParts = url.pathname.split('/');
    quoteId = pathParts[pathParts.length - 1];
  }

  if (!quoteId || quoteId === 'quote-view') {
    return new Response('Quote ID required', { status: 400 });
  }

  // Handle POST for approve action
  if (req.method === 'POST') {
    const body = await req.json();
    if (body.action === 'approve') {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', quoteId)
        .in('status', ['sent', 'viewed']); // Only allow approving sent/viewed quotes

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to approve quote' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Fetch quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    return new Response(JSON.stringify({ error: 'Quote not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch business settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', quote.user_id)
    .single();

  // Mark as viewed if not already
  if (quote.status === 'sent') {
    await supabase
      .from('quotes')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', quoteId);
  }

  // Build payment URL
  let paymentUrl: string | null = null;
  let paymentLabel = '';
  if (settings?.payment_method && settings.payment_method !== 'none' && settings.payment_link) {
    const config = PAYMENT_METHODS[settings.payment_method];
    if (config) {
      paymentUrl = config.buildUrl(settings.payment_link, quote.total);
      paymentLabel = config.label;
    }
  }

  // Determine if this is a quote or invoice
  const isInvoice = quote.type === 'invoice';
  const canApprove = !isInvoice && ['sent', 'viewed'].includes(quote.status);
  const canPay = isInvoice && quote.status === 'invoiced';

  // Return JSON data - client will render it
  const responseData = {
    quote: {
      id: quote.id,
      type: quote.type || 'quote',
      invoice_number: quote.invoice_number,
      customer_name: quote.customer_name,
      job_description: quote.job_description,
      line_items: quote.line_items,
      subtotal: quote.subtotal,
      tax: quote.tax,
      tax_rate: quote.tax_rate,
      total: quote.total,
      notes: quote.notes,
      status: quote.status,
      valid_until: quote.valid_until,
      work_date: quote.work_date,
      due_date: quote.due_date,
    },
    business: {
      name: settings?.business_name || 'Quote',
      phone: settings?.business_phone || '',
      email: settings?.business_email || '',
      address: settings?.business_address || '',
      logo_url: settings?.logo_url || '',
    },
    // Only show payment for invoices
    payment: canPay ? (paymentUrl ? {
      url: paymentUrl,
      label: paymentLabel,
    } : (settings?.payment_method === 'zelle' ? {
      method: 'zelle',
      details: settings?.payment_details,
    } : null)) : null,
    // Can customer approve this quote?
    canApprove,
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
});

