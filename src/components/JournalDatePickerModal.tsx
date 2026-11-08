import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { DailyDiaryService } from '../services/DailyDiaryService';
import { InputSanitizer } from '../security/InputSanitizer';

export class JournalDatePickerModalProps {
  public visible: boolean = false;
  public selectedDateKey: string = DailyDiaryService.getTodayDateKey();
  public existingDateKeys: string[] = [];
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public isDark: boolean = true;
  public onClose: () => void = () => {};
  public onSelectDate: (dateKey: string) => void = () => {};
}

export class JournalDatePickerModalState {
  public viewYear: number = new Date().getFullYear();
  public viewMonth: number = new Date().getMonth(); // 0-indexed: 0 = Jan, 11 = Dec
  public manualInputDate: string = '';
  public validationError: string = '';
}

export class JournalDatePickerModal extends React.Component<
  JournalDatePickerModalProps,
  JournalDatePickerModalState
> {
  private styles = JournalDatePickerModalStyles.styles;
  private readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  private readonly WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  constructor(props: JournalDatePickerModalProps) {
    super(props);
    const initialDate = this.parseDateKey(props.selectedDateKey);
    this.state = {
      viewYear: initialDate.getFullYear(),
      viewMonth: initialDate.getMonth(),
      manualInputDate: '',
      validationError: '',
    };
  }

  public componentDidUpdate(prevProps: JournalDatePickerModalProps): void {
    if (
      (!prevProps.visible && this.props.visible) ||
      prevProps.selectedDateKey !== this.props.selectedDateKey
    ) {
      const parsed = this.parseDateKey(this.props.selectedDateKey);
      this.setState({
        viewYear: parsed.getFullYear(),
        viewMonth: parsed.getMonth(),
        manualInputDate: '',
        validationError: '',
      });
    }
  }

  private parseDateKey(dateKey: string): Date {
    try {
      if (DailyDiaryService.isValidDateKey(dateKey)) {
        const [year, month, day] = dateKey.split('-').map((v) => parseInt(v, 10));
        return new Date(year, month - 1, day);
      }
    } catch {
      // Fallback
    }
    return new Date();
  }

  private navigateMonth = (direction: -1 | 1): void => {
    Haptics.selectionAsync();
    let nextMonth = this.state.viewMonth + direction;
    let nextYear = this.state.viewYear;

    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    this.setState({
      viewMonth: nextMonth,
      viewYear: nextYear,
      validationError: '',
    });
  };

  private selectDate = (dateKey: string): void => {
    if (!DailyDiaryService.isValidDateKey(dateKey)) {
      this.setState({ validationError: 'Invalid date selected.' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.props.onSelectDate(dateKey);
    this.props.onClose();
  };

  private jumpToToday = (): void => {
    const today = DailyDiaryService.getTodayDateKey();
    this.selectDate(today);
  };

  private jumpToYesterday = (): void => {
    const yesterday = DailyDiaryService.getAdjacentDateKey(DailyDiaryService.getTodayDateKey(), -1);
    this.selectDate(yesterday);
  };

  private handleManualJump = (): void => {
    const sanitized = InputSanitizer.sanitizeString(this.state.manualInputDate).trim();
    if (!DailyDiaryService.isValidDateKey(sanitized)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      this.setState({ validationError: 'Please enter a valid date in YYYY-MM-DD format.' });
      return;
    }

    this.selectDate(sanitized);
  };

  private renderCalendarGrid = (): React.ReactNode => {
    const { viewYear, viewMonth } = this.state;
    const { selectedDateKey, existingDateKeys, palette } = this.props;

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayKey = DailyDiaryService.getTodayDateKey();

    const cells: React.ReactNode[] = [];

    // Empty cells for leading offset before the 1st day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<View key={`blank_${i}`} style={this.styles.dayCell} />);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(viewMonth + 1).padStart(2, '0');
      const dateKey = `${viewYear}-${monthStr}-${dayStr}`;

      const isSelected = dateKey === selectedDateKey;
      const isToday = dateKey === todayKey;
      const hasJournal = existingDateKeys.includes(dateKey);

      cells.push(
        <TouchableOpacity
          key={`day_${dateKey}`}
          onPress={() => this.selectDate(dateKey)}
          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          accessibilityRole="button"
          accessibilityLabel={`${dateKey}${isToday ? ', Today' : ''}${hasJournal ? ', Entry exists' : ''}`}
          style={[
            this.styles.dayCell,
            isSelected && {
              backgroundColor: palette.accent,
              borderRadius: 12,
            },
            isToday && !isSelected && {
              borderWidth: 1,
              borderColor: palette.accent,
              borderRadius: 12,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              this.styles.dayNumberText,
              { color: isSelected ? palette.accentContrast : palette.textPrimary },
              isSelected && { fontWeight: '700' },
            ]}
          >
            {day}
          </Text>

          {/* Indicator dot showing that a journal entry exists for this day */}
          {hasJournal && (
            <View
              style={[
                this.styles.entryDot,
                { backgroundColor: isSelected ? palette.accentContrast : palette.accent },
              ]}
            />
          )}
        </TouchableOpacity>
      );
    }

    return <View style={this.styles.daysGrid}>{cells}</View>;
  };

  public render(): React.ReactNode {
    const { visible, palette, onClose } = this.props;
    const { viewYear, viewMonth, manualInputDate, validationError } = this.state;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={this.styles.modalOverlay}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

          <View
            style={[
              this.styles.dialogCard,
              {
                backgroundColor: palette.cardBackground,
                borderColor: palette.glassBorder,
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {/* Header */}
              <View style={this.styles.headerRow}>
              <View>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  📅 Select Journal Date
                </Text>
                <Text style={[this.styles.modalSubtitle, { color: palette.textSecondary }]}>
                  Jump to any day to view or record reflections
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                style={this.styles.closeButton}
              >
                <Text style={[this.styles.closeButtonText, { color: palette.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Actions (Today / Yesterday) */}
            <View style={this.styles.quickActionsRow}>
              <TouchableOpacity
                onPress={this.jumpToToday}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
                style={[
                  this.styles.quickPill,
                  { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder },
                ]}
              >
                <Text style={[this.styles.quickPillText, { color: palette.accent }]}>⭐ Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={this.jumpToYesterday}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Jump to yesterday"
                style={[
                  this.styles.quickPill,
                  { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder },
                ]}
              >
                <Text style={[this.styles.quickPillText, { color: palette.textPrimary }]}>
                  ◀ Yesterday
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation */}
            <View
              style={[
                this.styles.monthNavBar,
                { backgroundColor: palette.surfaceElevated, borderColor: palette.cardBorder },
              ]}
            >
              <TouchableOpacity
                onPress={() => this.navigateMonth(-1)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={this.styles.monthNavArrow}
              >
                <Text style={[this.styles.monthNavArrowText, { color: palette.accent }]}>◀</Text>
              </TouchableOpacity>

              <Text style={[this.styles.monthNavTitle, { color: palette.textPrimary }]}>
                {this.MONTH_NAMES[viewMonth]} {viewYear}
              </Text>

              <TouchableOpacity
                onPress={() => this.navigateMonth(1)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={this.styles.monthNavArrow}
              >
                <Text style={[this.styles.monthNavArrowText, { color: palette.accent }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Column Headers */}
            <View style={this.styles.weekdayRow}>
              {this.WEEKDAY_NAMES.map((wd, idx) => (
                <Text
                  key={`wd_${idx}`}
                  style={[this.styles.weekdayText, { color: palette.textMuted }]}
                >
                  {wd}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            {this.renderCalendarGrid()}

            {/* Direct YYYY-MM-DD input option */}
            <View style={[this.styles.manualInputSection, { borderTopColor: palette.divider }]}>
              <Text style={[this.styles.manualInputLabel, { color: palette.textSecondary }]}>
                Or type date directly (YYYY-MM-DD):
              </Text>
              <View style={this.styles.manualInputRow}>
                <TextInput
                  style={[
                    this.styles.manualInput,
                    {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.cardBorder,
                      color: palette.textPrimary,
                    },
                  ]}
                  value={manualInputDate}
                  onChangeText={(text) =>
                    this.setState({
                      manualInputDate: text,
                      validationError: '',
                    })
                  }
                  placeholder="e.g. 2026-10-15"
                  placeholderTextColor={palette.textMuted}
                  maxLength={10}
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={this.handleManualJump}
                />
                <TouchableOpacity
                  onPress={this.handleManualJump}
                  style={[this.styles.manualJumpBtn, { backgroundColor: palette.accent }]}
                >
                  <Text style={[this.styles.manualJumpBtnText, { color: palette.accentContrast }]}>Go</Text>
                </TouchableOpacity>
              </View>
              {Boolean(validationError) && (
                <Text style={[this.styles.errorText, { color: palette.danger }]}>
                  {validationError}
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    );
  }
}

class JournalDatePickerModalStyles {
  public static styles = StyleSheet.create<{
    modalOverlay: ViewStyle;
    dialogCard: ViewStyle;
    headerRow: ViewStyle;
    modalTitle: TextStyle;
    modalSubtitle: TextStyle;
    closeButton: ViewStyle;
    closeButtonText: TextStyle;
    quickActionsRow: ViewStyle;
    quickPill: ViewStyle;
    quickPillText: TextStyle;
    monthNavBar: ViewStyle;
    monthNavArrow: ViewStyle;
    monthNavArrowText: TextStyle;
    monthNavTitle: TextStyle;
    weekdayRow: ViewStyle;
    weekdayText: TextStyle;
    daysGrid: ViewStyle;
    dayCell: ViewStyle;
    dayNumberText: TextStyle;
    entryDot: ViewStyle;
    manualInputSection: ViewStyle;
    manualInputLabel: TextStyle;
    manualInputRow: ViewStyle;
    manualInput: TextStyle;
    manualJumpBtn: ViewStyle;
    manualJumpBtnText: TextStyle;
    errorText: TextStyle;
  }>({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 390,
      maxHeight: '88%',
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    closeButton: {
      padding: 6,
    },
    closeButtonText: {
      fontSize: 18,
      fontWeight: '600',
    },
    quickActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    quickPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    quickPillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    monthNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    monthNavArrow: {
      padding: 6,
    },
    monthNavArrowText: {
      fontSize: 14,
      fontWeight: '700',
    },
    monthNavTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    weekdayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    weekdayText: {
      width: '14.28%',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 14,
    },
    dayCell: {
      width: '14.28%',
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    dayNumberText: {
      fontSize: 14,
      fontWeight: '500',
    },
    entryDot: {
      position: 'absolute',
      bottom: 4,
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    manualInputSection: {
      marginTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
      paddingTop: 12,
    },
    manualInputLabel: {
      fontSize: 11,
      marginBottom: 6,
    },
    manualInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    manualInput: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 16,
      fontSize: 14,
    },
    manualJumpBtn: {
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    manualJumpBtnText: {
      color: '#0B0B0E',
      fontSize: 13,
      fontWeight: '700',
    },
    errorText: {
      fontSize: 11,
      marginTop: 4,
      fontWeight: '500',
    },
  });
}
