import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  Alert,
  Modal,
  Share,
  ActivityIndicator,
  Linking,
  Clipboard,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatPhone, getStatusColor, getStatusLabel, timeAgo } from '@/lib/utils';
import { getPaymentUrl, getPaymentInstructions, getPaymentButtonLabel } from '@/lib/payments';
import { colors } from '@/lib/colors';
import PhotoPicker from '@/components/PhotoPicker';
import type { Quote, LineItem, QuoteAttachment } from '@/types';

export default function QuoteDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id, showSaveToPricebook } = useLocalSearchParams<{ id: string; showSaveToPricebook?: string }>();
  const { quotes, settings, updateQuote, deleteQuote, pricebook, addPricebookItem } = useStore();
  const navigation = useNavigation();

  const quote = quotes.find(q => q.id === id);
  const [showPricebookModal, setShowPricebookModal] = useState(showSaveToPricebook === 'true');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [savingToPricebook, setSavingToPricebook] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Invoice date fields - default work_date to today, due_date to 3 days from now
  const getDefaultDates = () => {
    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 3);
    return { workDate: today, dueDate: due };
  };
  const [workDate, setWorkDate] = useState<Date>(getDefaultDates().workDate);
  const [dueDate, setDueDate] = useState<Date>(getDefaultDates().dueDate);
  const [showWorkDatePicker, setShowWorkDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // Photo state
  const [pendingPhotos, setPendingPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Format date for display
  const formatDateDisplay = (date: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Convert Date to YYYY-MM-DD string for database
  const toDateString = (date: Date) => date.toISOString().split('T')[0];

  // Check if it's an invoice (by type or by status being invoiced/paid)
  const isInvoice = quote?.type === 'invoice' || ['invoiced', 'paid'].includes(quote?.status || '');
  const isJob = quote?.status === 'approved';

  // Get document type label: Quote → Job → Invoice
  const getDocLabel = () => {
    if (isInvoice) return 'Invoice';
    if (isJob) return 'Job';
    return 'Quote';
  };

  // Set header options with fresh callbacks
  useLayoutEffect(() => {
    navigation.setOptions({
      title: getDocLabel(),
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <FontAwesome name="arrow-left" size={18} color={isDark ? colors.text.primaryDark : colors.text.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.headerButton}>
          <FontAwesome name="ellipsis-v" size={20} color={isDark ? colors.text.primaryDark : colors.text.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isDark, isInvoice, isJob]);

  // Get guessed items from quote
  const guessedItems = (quote?.line_items || []).filter((item: any) => item.is_guess);

  // Quote URL for customer view (static page)
  const quoteBaseUrl = process.env.EXPO_PUBLIC_QUOTE_PAGE_URL || 'https://q.blitzquotes.com';
  const quoteUrl = `${quoteBaseUrl}/?id=${id}`;

  useEffect(() => {
    // Auto-select all guessed items initially
    if (showSaveToPricebook === 'true' && guessedItems.length > 0) {
      setSelectedItems(new Set(guessedItems.map((_, i) => i)));
    }
  }, [showSaveToPricebook]);

  if (!quote) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
        <Text style={{ color: isDark ? colors.text.primaryDark : colors.text.primary }}>Quote not found</Text>
      </View>
    );
  }

  const markAsSent = async () => {
    if (quote.status === 'draft') {
      try {
        const { error } = await supabase
          .from('quotes')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', quote.id);

        if (error) throw error;
        updateQuote(quote.id, { status: 'sent', sent_at: new Date().toISOString() });
      } catch (error: any) {
        console.error('Failed to mark as sent:', error);
      }
    }
  };

  const markAsApproved = async () => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', quote.id);

      if (error) throw error;
      updateQuote(quote.id, { status: 'approved', approved_at: new Date().toISOString() });
      Alert.alert('Success', 'Marked as approved!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark as approved');
    }
  };

  // Open invoice modal to set dates before converting
  const handleConvertToInvoice = () => {
    // Reset dates to defaults
    const defaults = getDefaultDates();
    setWorkDate(defaults.workDate);
    setDueDate(defaults.dueDate);
    setShowInvoiceModal(true);
  };

  // Actually convert to invoice with the selected dates
  const confirmConvertToInvoice = async () => {
    setInvoiceLoading(true);
    try {
      // Get count of existing invoices for numbering
      const { count } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', quote.user_id)
        .eq('type', 'invoice');

      const invoiceNumber = `INV-${((count || 0) + 1).toString().padStart(3, '0')}`;

      const { error } = await supabase
        .from('quotes')
        .update({
          type: 'invoice',
          invoice_number: invoiceNumber,
          status: 'invoiced',
          invoiced_at: new Date().toISOString(),
          work_date: toDateString(workDate),
          due_date: toDateString(dueDate),
        })
        .eq('id', quote.id);

      if (error) throw error;
      updateQuote(quote.id, {
        type: 'invoice',
        invoice_number: invoiceNumber,
        status: 'invoiced',
        invoiced_at: new Date().toISOString(),
        work_date: toDateString(workDate),
        due_date: toDateString(dueDate),
      });

      setShowInvoiceModal(false);
      // Show send modal so user can choose how to notify customer
      setShowSendModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to convert to invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const markAsPaid = async () => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', quote.id);

      if (error) throw error;
      updateQuote(quote.id, { status: 'paid', paid_at: new Date().toISOString() });
      Alert.alert('Success', 'Invoice marked as paid!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark as paid');
    }
  };

  const getShareMessage = () => {
    const businessName = settings?.business_name || 'Your contractor';
    return `Hi ${quote.customer_name},\n\nHere's your ${getDocLabel().toLowerCase()} from ${businessName}:\n\nTotal: ${formatCurrency(quote.total)}\n\nView details & pay: ${quoteUrl}`;
  };

  const handleSendSMS = async () => {
    if (!quote.customer_phone) {
      Alert.alert('No Phone Number', 'Add a phone number to send via SMS');
      return;
    }

    const message = encodeURIComponent(getShareMessage());
    const phone = quote.customer_phone.replace(/\D/g, '');
    const smsUrl = `sms:${phone}&body=${message}`;

    try {
      await Linking.openURL(smsUrl);
      setShowSendModal(false);
      markAsSent();
    } catch (error) {
      Alert.alert('Error', 'Could not open SMS app');
    }
  };

  const handleSendEmail = async () => {
    if (!quote.customer_email) {
      return;
    }

    const businessName = settings?.business_name || 'Your contractor';
    const docLabel = getDocLabel();
    const subject = encodeURIComponent(`${docLabel} from ${businessName} - ${formatCurrency(quote.total)}`);
    const body = encodeURIComponent(getShareMessage());
    const emailUrl = `mailto:${quote.customer_email}?subject=${subject}&body=${body}`;

    try {
      await Linking.openURL(emailUrl);
      setShowSendModal(false);
      markAsSent();
    } catch (error) {
      Alert.alert('Error', 'Could not open email app');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: getShareMessage() });
      setShowSendModal(false);
      markAsSent();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(quoteUrl);
    Alert.alert('Copied!', `${getDocLabel()} link copied to clipboard`);
    setShowSendModal(false);
    markAsSent();
  };

  const handleDelete = () => {
    const docLabel = getDocLabel();
    Alert.alert(
      `Delete ${docLabel}`,
      `Are you sure you want to delete this ${docLabel.toLowerCase()} for ${quote.customer_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('quotes')
                .delete()
                .eq('id', quote.id);

              if (error) throw error;
              deleteQuote(quote.id);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete quote');
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = () => {
    router.push(`/quote/new?duplicateId=${id}`);
  };

  // Photo handlers
  const handleAddPhotos = async (newPhotos: { uri: string; name: string }[]) => {
    setPendingPhotos(prev => [...prev, ...newPhotos]);

    // Auto-upload immediately
    setUploadingPhotos(true);
    try {
      const uploaded: QuoteAttachment[] = [];

      for (const photo of newPhotos) {
        const fileExt = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${quote.user_id}/${quote.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        // Fetch and convert to ArrayBuffer
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('quote-attachments')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('quote-attachments')
          .getPublicUrl(fileName);

        uploaded.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          url: publicUrl,
          name: photo.name,
          size: blob.size,
          type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          uploaded_at: new Date().toISOString(),
        });
      }

      if (uploaded.length > 0) {
        // Update quote with new attachments
        const newAttachments = [...(quote.attachments || []), ...uploaded];
        const { error } = await supabase
          .from('quotes')
          .update({ attachments: newAttachments })
          .eq('id', quote.id);

        if (error) throw error;
        updateQuote(quote.id, { attachments: newAttachments });
      }

      // Clear pending photos
      setPendingPhotos([]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const attachments = quote.attachments || [];
    if (index >= attachments.length) {
      // Remove from pending
      setPendingPhotos(prev => prev.filter((_, i) => i !== index - attachments.length));
      return;
    }

    // Remove from saved attachments
    const newAttachments = attachments.filter((_, i) => i !== index);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ attachments: newAttachments })
        .eq('id', quote.id);

      if (error) throw error;
      updateQuote(quote.id, { attachments: newAttachments });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove photo');
    }
  };

  const toggleItemSelection = (index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSaveToPricebook = async () => {
    if (selectedItems.size === 0) {
      setShowPricebookModal(false);
      return;
    }

    setSavingToPricebook(true);
    try {
      const itemsToSave = Array.from(selectedItems).map(index => guessedItems[index]);

      const pricebookItems = itemsToSave.map(item => ({
        user_id: quote.user_id,
        name: item.name,
        category: 'materials' as const, // Default, user can edit later
        unit: item.unit,
        cost: Math.round(item.unit_price * 0.6 * 100) / 100, // Estimate cost as 60% of price
        price: item.unit_price,
        default_qty: item.qty,
      }));

      const { data, error } = await supabase
        .from('pricebook_items')
        .insert(pricebookItems)
        .select();

      if (error) throw error;

      if (data) {
        data.forEach(item => addPricebookItem(item));
        Alert.alert('Success', `${data.length} item${data.length > 1 ? 's' : ''} saved to your pricebook`);
      }

      setShowPricebookModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save items');
    } finally {
      setSavingToPricebook(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: getDocLabel() }} />
      <View style={[styles.container, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Card */}
          <View style={[styles.headerCard, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={[styles.customerName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                  {quote.customer_name}
                </Text>
                {quote.customer_phone && (
                  <Text style={[styles.customerPhone, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    {formatPhone(quote.customer_phone)}
                  </Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(quote.status) }]}>
                  {getStatusLabel(quote.status)}
                </Text>
              </View>
            </View>
            <Text style={[styles.jobDescription, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              {quote.job_description}
            </Text>

            {/* Job address */}
            {quote.job_address && (
              <View style={styles.dateInfoRow}>
                <FontAwesome name="map-marker" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                <Text style={[styles.dateInfoText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  {quote.job_address}
                </Text>
              </View>
            )}

            {/* Date information */}
            {!isInvoice && quote.valid_until && (
              <View style={styles.dateInfoRow}>
                <FontAwesome name="calendar" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                <Text style={[styles.dateInfoText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Valid until {formatDateDisplay(quote.valid_until)}
                </Text>
              </View>
            )}
            {isInvoice && (
              <View style={styles.dateInfoContainer}>
                {quote.work_date && (
                  <View style={styles.dateInfoRow}>
                    <FontAwesome name="calendar-check-o" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                    <Text style={[styles.dateInfoText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                      Work completed {formatDateDisplay(quote.work_date)}
                    </Text>
                  </View>
                )}
                {quote.due_date && (
                  <View style={styles.dateInfoRow}>
                    <FontAwesome name="clock-o" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                    <Text style={[styles.dateInfoText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                      Due {formatDateDisplay(quote.due_date)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {quote.status === 'viewed' && quote.viewed_at && (
              <View style={styles.viewedBanner}>
                <FontAwesome name="eye" size={14} color={colors.status.warning} />
                <Text style={styles.viewedBannerText}>
                  Viewed {timeAgo(quote.viewed_at)}
                </Text>
              </View>
            )}
          </View>

          {/* Line Items */}
          <Text style={[styles.sectionHeader, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
            LINE ITEMS
          </Text>

          {quote.line_items.map((item: LineItem, index: number) => (
            <View
              key={index}
              style={[styles.lineItem, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
              <View style={styles.lineItemTop}>
                <Text style={[styles.lineItemName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                  {item.name}
                </Text>
                <Text style={[styles.lineItemTotal, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
              <Text style={[styles.lineItemMeta, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                {item.qty} {item.unit} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
          ))}

          {/* Labor */}
          {quote.labor_hours > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                LABOR
              </Text>
              <View style={[styles.lineItem, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
                <View style={styles.lineItemTop}>
                  <Text style={[styles.lineItemName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    Labor
                  </Text>
                  <Text style={[styles.lineItemTotal, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    {formatCurrency(quote.labor_total)}
                  </Text>
                </View>
                <Text style={[styles.lineItemMeta, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  {quote.labor_hours} hrs × {formatCurrency(quote.labor_rate)}/hr
                </Text>
              </View>
            </>
          )}

          {/* Totals */}
          <View style={[styles.totalsCard, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>Subtotal</Text>
              <Text style={[styles.totalsValue, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                {formatCurrency(quote.subtotal)}
              </Text>
            </View>
            {quote.tax > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Tax ({(quote.tax_rate * 100).toFixed(1)}%)
                </Text>
                <Text style={[styles.totalsValue, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                  {formatCurrency(quote.tax)}
                </Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.primary.blue }]}>
                {formatCurrency(quote.total)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {quote.notes && (
            <>
              <Text style={[styles.sectionHeader, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                NOTES
              </Text>
              <View style={[styles.notesCard, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
                <Text style={[styles.notesText, { color: isDark ? colors.gray[300] : colors.gray[600] }]}>
                  {quote.notes}
                </Text>
              </View>
            </>
          )}

          {/* Photos */}
          <View style={[styles.photoSection, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.photoSectionHeader}>
              <Text style={[styles.photoSectionTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Photos
              </Text>
              {uploadingPhotos && <ActivityIndicator size="small" color={colors.primary.blue} />}
            </View>
            <PhotoPicker
              photos={[
                ...(quote.attachments || []).map(a => ({ id: a.id, uri: a.url, name: a.name, isNew: false })),
                ...pendingPhotos.map((p, i) => ({ id: `pending-${i}`, uri: p.uri, name: p.name, isNew: true })),
              ]}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              maxPhotos={20}
            />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { backgroundColor: isDark ? colors.background.primaryDark : colors.background.primary }]}>
          {/* Draft: Send Quote */}
          {quote.status === 'draft' && (
            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowSendModal(true)}>
              <FontAwesome name="send" size={16} color={colors.text.inverse} />
              <Text style={styles.primaryButtonText}>Send Quote</Text>
            </TouchableOpacity>
          )}

          {/* Sent/Viewed: Resend + Mark Approved */}
          {(quote.status === 'sent' || quote.status === 'viewed') && (
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                onPress={() => setShowSendModal(true)}>
                <FontAwesome name="share" size={16} color={isDark ? colors.text.primaryDark : colors.text.primary} />
                <Text style={[styles.secondaryButtonText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>Resend</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.approvedButton} onPress={markAsApproved}>
                <FontAwesome name="thumbs-up" size={16} color={colors.text.inverse} />
                <Text style={styles.approvedButtonText}>Mark Approved</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Approved: Convert to Invoice */}
          {quote.status === 'approved' && (
            <TouchableOpacity style={styles.invoiceButton} onPress={handleConvertToInvoice}>
              <FontAwesome name="file-text" size={16} color={colors.text.inverse} />
              <Text style={styles.invoiceButtonText}>Convert to Invoice</Text>
            </TouchableOpacity>
          )}

          {/* Invoiced: Resend Invoice + Mark Paid */}
          {quote.status === 'invoiced' && (
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                onPress={() => setShowSendModal(true)}>
                <FontAwesome name="share" size={16} color={isDark ? colors.text.primaryDark : colors.text.primary} />
                <Text style={[styles.secondaryButtonText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>Send Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.paidButton} onPress={markAsPaid}>
                <FontAwesome name="check" size={16} color={colors.text.inverse} />
                <Text style={styles.paidButtonText}>Mark Paid</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Paid: Show confirmation */}
          {quote.status === 'paid' && (
            <View style={styles.paidBanner}>
              <FontAwesome name="check-circle" size={20} color={colors.status.success} />
              <Text style={styles.paidBannerText}>Paid {quote.paid_at ? timeAgo(quote.paid_at) : ''}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions Menu Modal */}
      <Modal
        visible={showMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push(`/quote/new?editId=${id}`);
              }}>
              <FontAwesome name="pencil" size={16} color={colors.primary.blue} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Edit {getDocLabel()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleDuplicate();
              }}>
              <FontAwesome name="copy" size={16} color={colors.special.purple} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>Duplicate</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: isDark ? colors.border.dark : colors.border.light }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleDelete();
              }}>
              <FontAwesome name="trash-o" size={16} color={colors.status.error} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: colors.status.error }]}>
                Delete {getDocLabel()}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Send Quote Modal */}
      <Modal
        visible={showSendModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sendModalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Send {getDocLabel()}
              </Text>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <FontAwesome name="times" size={20} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sendModalSubtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              Send to {quote.customer_name}
              {quote.customer_phone ? ` • ${formatPhone(quote.customer_phone)}` : ''}
              {quote.customer_email ? ` • ${quote.customer_email}` : ''}
            </Text>

            <View style={styles.sendOptions}>
              <TouchableOpacity
                style={[styles.sendOption, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                onPress={handleSendSMS}>
                <View style={[styles.sendOptionIcon, { backgroundColor: colors.status.success }]}>
                  <FontAwesome name="comment" size={20} color={colors.text.inverse} />
                </View>
                <View style={styles.sendOptionText}>
                  <Text style={[styles.sendOptionTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    Text Message
                  </Text>
                  <Text style={[styles.sendOptionDesc, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    {quote.customer_phone ? `Open SMS with ${getDocLabel().toLowerCase()} link` : 'No phone number'}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendOption,
                  { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] },
                  !quote.customer_email && styles.sendOptionDisabled,
                ]}
                onPress={handleSendEmail}
                disabled={!quote.customer_email}>
                <View style={[styles.sendOptionIcon, { backgroundColor: quote.customer_email ? colors.status.error : colors.text.placeholder }]}>
                  <FontAwesome name="envelope" size={20} color={colors.text.inverse} />
                </View>
                <View style={styles.sendOptionText}>
                  <Text style={[
                    styles.sendOptionTitle,
                    { color: quote.customer_email ? (isDark ? colors.text.primaryDark : colors.text.primary) : (isDark ? colors.text.placeholderDark : colors.text.placeholder) }
                  ]}>
                    Email
                  </Text>
                  <Text style={[styles.sendOptionDesc, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    {quote.customer_email || 'No email address'}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendOption, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                onPress={handleShare}>
                <View style={[styles.sendOptionIcon, { backgroundColor: colors.primary.blue }]}>
                  <FontAwesome name="share" size={20} color={colors.text.inverse} />
                </View>
                <View style={styles.sendOptionText}>
                  <Text style={[styles.sendOptionTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    Share
                  </Text>
                  <Text style={[styles.sendOptionDesc, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    Email, WhatsApp, other apps
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendOption, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                onPress={handleCopyLink}>
                <View style={[styles.sendOptionIcon, { backgroundColor: colors.special.purple }]}>
                  <FontAwesome name="link" size={20} color={colors.text.inverse} />
                </View>
                <View style={styles.sendOptionText}>
                  <Text style={[styles.sendOptionTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    Copy Link
                  </Text>
                  <Text style={[styles.sendOptionDesc, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                    Copy {getDocLabel().toLowerCase()} URL to clipboard
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Convert to Invoice Modal */}
      <Modal
        visible={showInvoiceModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowInvoiceModal(false);
          setShowWorkDatePicker(false);
          setShowDueDatePicker(false);
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.invoiceModalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Convert to Invoice
              </Text>
              <TouchableOpacity onPress={() => {
                setShowInvoiceModal(false);
                setShowWorkDatePicker(false);
                setShowDueDatePicker(false);
              }}>
                <FontAwesome name="times" size={20} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.invoiceModalSubtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              Set work completion and payment due dates
            </Text>

            <View style={styles.invoiceDateFields}>
              <View style={styles.invoiceDateField}>
                <Text style={[styles.invoiceDateLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Work completed on
                </Text>
                <TouchableOpacity
                  style={[styles.invoiceDateInput, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                  onPress={() => {
                    setShowDueDatePicker(false);
                    setShowWorkDatePicker(true);
                  }}>
                  <FontAwesome name="calendar-check-o" size={16} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
                  <Text style={[styles.invoiceDateText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    {formatDateDisplay(workDate)}
                  </Text>
                </TouchableOpacity>
                {showWorkDatePicker && Platform.OS === 'ios' && (
                  <View style={[styles.datePickerContainer, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
                    <View style={[styles.datePickerHeader, { borderBottomColor: isDark ? colors.gray[600] : colors.border.light }]}>
                      <TouchableOpacity onPress={() => setShowWorkDatePicker(false)}>
                        <Text style={styles.datePickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={workDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, date) => {
                        if (date) setWorkDate(date);
                      }}
                      themeVariant={isDark ? 'dark' : 'light'}
                    />
                  </View>
                )}
                {showWorkDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={workDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowWorkDatePicker(false);
                      if (date) setWorkDate(date);
                    }}
                  />
                )}
              </View>

              <View style={styles.invoiceDateField}>
                <Text style={[styles.invoiceDateLabel, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Payment due by
                </Text>
                <TouchableOpacity
                  style={[styles.invoiceDateInput, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                  onPress={() => {
                    setShowWorkDatePicker(false);
                    setShowDueDatePicker(true);
                  }}>
                  <FontAwesome name="calendar" size={16} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
                  <Text style={[styles.invoiceDateText, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                    {formatDateDisplay(dueDate)}
                  </Text>
                </TouchableOpacity>
                {showDueDatePicker && Platform.OS === 'ios' && (
                  <View style={[styles.datePickerContainer, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}>
                    <View style={[styles.datePickerHeader, { borderBottomColor: isDark ? colors.gray[600] : colors.border.light }]}>
                      <TouchableOpacity onPress={() => setShowDueDatePicker(false)}>
                        <Text style={styles.datePickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={dueDate}
                      themeVariant={isDark ? 'dark' : 'light'}
                      mode="date"
                      display="spinner"
                      onChange={(event, date) => {
                        if (date) setDueDate(date);
                      }}
                    />
                  </View>
                )}
                {showDueDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowDueDatePicker(false);
                      if (date) setDueDate(date);
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.invoiceModalFooter}>
              <TouchableOpacity
                style={styles.invoiceModalCancelButton}
                onPress={() => {
                  setShowInvoiceModal(false);
                  setShowWorkDatePicker(false);
                  setShowDueDatePicker(false);
                }}>
                <Text style={[styles.invoiceModalCancelText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.invoiceModalConfirmButton, invoiceLoading && styles.buttonDisabled]}
                onPress={confirmConvertToInvoice}
                disabled={invoiceLoading}>
                {invoiceLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <>
                    <FontAwesome name="file-text" size={16} color={colors.text.inverse} />
                    <Text style={styles.invoiceModalConfirmText}>Create Invoice</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save to Pricebook Modal */}
      <Modal
        visible={showPricebookModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPricebookModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.background.secondaryDark : colors.background.secondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                Save to Pricebook?
              </Text>
              <TouchableOpacity onPress={() => setShowPricebookModal(false)}>
                <FontAwesome name="times" size={20} color={isDark ? colors.text.secondaryDark : colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
              These items were AI-estimated. Save them to your pricebook for future quotes.
            </Text>

            <ScrollView style={styles.modalList}>
              {guessedItems.map((item: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalItem,
                    { backgroundColor: isDark ? colors.gray[700] : colors.background.primary },
                    selectedItems.has(index) && styles.modalItemSelected,
                  ]}
                  onPress={() => toggleItemSelection(index)}>
                  <View style={styles.modalItemCheck}>
                    {selectedItems.has(index) ? (
                      <FontAwesome name="check-square" size={20} color={colors.primary.blue} />
                    ) : (
                      <FontAwesome name="square-o" size={20} color={isDark ? colors.text.placeholderDark : colors.text.placeholder} />
                    )}
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={[styles.modalItemName, { color: isDark ? colors.text.primaryDark : colors.text.primary }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.modalItemPrice, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                      {formatCurrency(item.unit_price)} / {item.unit}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalSkipButton}
                onPress={() => setShowPricebookModal(false)}>
                <Text style={[styles.modalSkipText, { color: isDark ? colors.text.secondaryDark : colors.text.secondary }]}>
                  Skip
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, savingToPricebook && styles.buttonDisabled]}
                onPress={handleSaveToPricebook}
                disabled={savingToPricebook}>
                {savingToPricebook ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.modalSaveText}>
                    Save {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerButton: {
    padding: 8,
  },
  headerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  jobDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  viewedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  viewedBannerText: {
    fontSize: 14,
    color: colors.status.warning,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  lineItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  lineItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  lineItemTotal: {
    fontSize: 15,
    fontWeight: '600',
  },
  lineItemMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  totalsCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalsLabel: {
    fontSize: 15,
  },
  totalsValue: {
    fontSize: 15,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  notesCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.primary.blue,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContent: {
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIcon: {
    width: 24,
    textAlign: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  modalItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary.blue,
  },
  modalItemCheck: {
    marginRight: 12,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalItemPrice: {
    fontSize: 13,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingBottom: 20,
  },
  modalSkipButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSkipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 2,
    height: 48,
    backgroundColor: colors.primary.blue,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  approvedButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.special.purple,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  approvedButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  invoiceButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.special.pink,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  invoiceButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  paidButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.status.success,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paidButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: colors.status.successBg,
    borderRadius: 14,
  },
  paidBannerText: {
    color: colors.status.success,
    fontSize: 16,
    fontWeight: '600',
  },
  // Send modal styles
  sendModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sendModalSubtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  sendOptions: {
    gap: 10,
  },
  sendOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
  },
  sendOptionDisabled: {
    opacity: 0.5,
  },
  sendOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sendOptionText: {
    flex: 1,
  },
  sendOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  // Date info styles
  dateInfoContainer: {
    marginTop: 12,
    gap: 6,
  },
  dateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dateInfoText: {
    fontSize: 14,
  },
  // Invoice modal styles
  invoiceModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  invoiceModalSubtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  invoiceDateFields: {
    gap: 16,
    marginBottom: 24,
  },
  invoiceDateField: {
    gap: 8,
  },
  invoiceDateLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  invoiceDateValue: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  invoiceDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  invoiceDateText: {
    fontSize: 16,
  },
  datePickerContainer: {
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.blue,
  },
  invoiceModalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  invoiceModalCancelButton: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  invoiceModalConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.special.pink,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  invoiceModalConfirmText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  photoSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  photoSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray[200],
  },
});
