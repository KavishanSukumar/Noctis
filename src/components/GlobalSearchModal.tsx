import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  GlobalSearchResult,
  BookItem,
  KnowledgeItem,
  ReferenceLinkItem,
  DailyRecurringTask,
  ProjectItem,
  DiaryEntry,
  SecondBrainNote,
  GeneralTodoItem,
} from '../models/NoctisModels';
import { ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { SecondBrainPKMService } from '../services/SecondBrainPKMService';

export class GlobalSearchModalProps {
  public visible: boolean = false;
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public books: BookItem[] = [];
  public knowledgeItems: KnowledgeItem[] = [];
  public referenceLinks: ReferenceLinkItem[] = [];
  public dailyRecurringTasks: DailyRecurringTask[] = [];
  public projects: ProjectItem[] = [];
  public diaryEntries: DiaryEntry[] = [];
  public secondBrainNotes: SecondBrainNote[] = [];
  public generalTodos: GeneralTodoItem[] = [];
  public onClose: () => void = () => {};
  public onSelectResult: (result: GlobalSearchResult) => void = () => {};
}

export class GlobalSearchModalState {
  public searchQuery: string = '';
  public selectedModule: 'all' | GlobalSearchResult['module'] = 'all';
}

export class GlobalSearchModal extends React.Component<
  GlobalSearchModalProps,
  GlobalSearchModalState
> {
  private styles = GlobalSearchModalStyles.styles;

  constructor(props: GlobalSearchModalProps) {
    super(props);
    this.state = {
      searchQuery: '',
      selectedModule: 'all',
    };
  }

  private renderHighlightedText = (
    text: string,
    query: string,
    baseColor: string,
    accentColor: string
  ): React.ReactNode => {
    if (!query || query.trim().length === 0) {
      return <Text style={{ color: baseColor }}>{text}</Text>;
    }

    const q = query.trim().toLowerCase();
    const parts: React.ReactNode[] = [];
    let startIdx = 0;
    const lower = text.toLowerCase();

    while (startIdx < text.length) {
      const matchIdx = lower.indexOf(q, startIdx);
      if (matchIdx === -1) {
        parts.push(
          <Text key={startIdx} style={{ color: baseColor }}>
            {text.slice(startIdx)}
          </Text>
        );
        break;
      }

      if (matchIdx > startIdx) {
        parts.push(
          <Text key={startIdx} style={{ color: baseColor }}>
            {text.slice(startIdx, matchIdx)}
          </Text>
        );
      }

      parts.push(
        <Text
          key={matchIdx}
          style={{
            backgroundColor: accentColor,
            color: this.props.palette.accentContrast,
            fontWeight: '700',
            borderRadius: 3,
            paddingHorizontal: 2,
          }}
        >
          {text.slice(matchIdx, matchIdx + q.length)}
        </Text>
      );

      startIdx = matchIdx + q.length;
    }

    return <Text>{parts}</Text>;
  };

  public override render() {
    const { palette, visible, onClose, onSelectResult } = this.props;
    const { searchQuery } = this.state;

    const rawResults = SecondBrainPKMService.executeGlobalSearch(searchQuery, {
      books: this.props.books,
      knowledgeItems: this.props.knowledgeItems,
      referenceLinks: this.props.referenceLinks,
      dailyRecurringTasks: this.props.dailyRecurringTasks,
      projects: this.props.projects,
      diaryEntries: this.props.diaryEntries,
      secondBrainNotes: this.props.secondBrainNotes,
      generalTodos: this.props.generalTodos,
    });

    const results = this.state.selectedModule === 'all'
      ? rawResults
      : rawResults.filter((r) => r.module === this.state.selectedModule);

    const categories: Array<{ id: 'all' | GlobalSearchResult['module']; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'journal', label: 'Journal' },
      { id: 'todos', label: 'To-Dos' },
      { id: 'books', label: 'Books' },
      { id: 'knowledge', label: 'Knowledge' },
      { id: 'links', label: 'Links' },
      { id: 'projects', label: 'Projects' },
      { id: 'daily_tasks', label: 'Routines' },
    ];

    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[this.styles.modalBackdrop, { paddingHorizontal: Math.max(16, this.props.metrics?.horizontalPadding || 16), paddingBottom: Math.max(16, this.props.metrics?.safeBottomInset || 16) }]}
        >
          <View style={[this.styles.searchCard, { backgroundColor: palette.surface, borderColor: palette.glassBorder }]}>
            {/* Search Header */}
            <View style={this.styles.headerRow}>
              <Text style={[this.styles.headerTitle, { color: palette.textPrimary }]}>
                Global Knowledge Search
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close search modal"
                style={this.styles.closeBtn}
              >
                <Text style={[this.styles.closeText, { color: palette.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input Bar with Clear Action */}
            <View style={[this.styles.inputContainer, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                autoFocus
                style={[this.styles.searchInput, { color: palette.textPrimary }]}
                value={searchQuery}
                onChangeText={(txt) => this.setState({ searchQuery: txt })}
                placeholder="Search across books, notes, links, tasks, journal..."
                placeholderTextColor={palette.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => this.setState({ searchQuery: '' })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search text"
                  style={this.styles.clearSearchBtn}
                >
                  <Text style={{ color: palette.textMuted, fontSize: 14, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Scope Filter Pills */}
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={this.styles.scopeRow}
              style={{ flexGrow: 0, marginBottom: 12 }}
            >
              {categories.map((cat) => {
                const isSelected = this.state.selectedModule === cat.id;
                const count = cat.id === 'all'
                  ? rawResults.length
                  : rawResults.filter((r) => r.module === cat.id).length;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      this.setState({ selectedModule: cat.id });
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={[
                      this.styles.scopePill,
                      {
                        backgroundColor: isSelected ? palette.accent : palette.glassElevated,
                        borderColor: isSelected ? palette.accent : palette.glassBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        this.styles.scopePillText,
                        { color: isSelected ? palette.accentContrast : palette.textSecondary },
                      ]}
                    >
                      {cat.label} {searchQuery.trim().length >= 2 ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Results List */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + (this.props.metrics?.safeBottomInset || 20) }}>
              {searchQuery.trim().length < 2 ? (
                <View style={this.styles.emptyPrompt}>
                  <Text style={[this.styles.emptyPromptText, { color: palette.textMuted }]}>
                    Type at least 2 characters to search across books, quotes, future knowledge, links, projects, and journal entries.
                  </Text>
                </View>
              ) : results.length === 0 ? (
                <View style={this.styles.emptyPrompt}>
                  <Text style={[this.styles.emptyPromptText, { color: palette.textMuted }]}>
                    No matching results found for "{searchQuery}".
                  </Text>
                </View>
              ) : (
                results.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelectResult(item);
                      onClose();
                    }}
                    style={[
                      this.styles.resultItem,
                      {
                        backgroundColor: palette.cardBackground,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    {/* Breadcrumbs Path */}
                    <View style={this.styles.breadcrumbRow}>
                      {item.breadcrumbs.map((crumb, idx) => (
                        <React.Fragment key={idx}>
                          <Text style={[this.styles.breadcrumbText, { color: palette.accent }]}>
                            {crumb}
                          </Text>
                          {idx < item.breadcrumbs.length - 1 && (
                            <Text style={[this.styles.breadcrumbSep, { color: palette.textMuted }]}>
                              {' › '}
                            </Text>
                          )}
                        </React.Fragment>
                      ))}
                    </View>

                    {/* Matched Title */}
                    <Text style={[this.styles.resultTitle, { color: palette.textPrimary }]}>
                      {this.renderHighlightedText(item.title, searchQuery, palette.textPrimary, palette.accent)}
                    </Text>

                    {/* Matched Snippet */}
                    <Text style={[this.styles.resultSnippet, { color: palette.textSecondary }]} numberOfLines={3}>
                      {this.renderHighlightedText(item.snippet, searchQuery, palette.textSecondary, palette.accent)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

export class GlobalSearchModalStyles {
  public static readonly styles = StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      padding: 16,
    } as ViewStyle,
    searchCard: {
      maxHeight: '85%',
      borderWidth: 1,
      borderRadius: 24,
      padding: 18,
    } as ViewStyle,
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
    } as TextStyle,
    closeBtn: {
      padding: 6,
    } as ViewStyle,
    closeText: {
      fontSize: 18,
      fontWeight: '700',
    } as TextStyle,
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 2,
      marginBottom: 10,
    } as ViewStyle,
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 6,
      fontSize: 14,
    } as TextStyle,
    clearSearchBtn: {
      padding: 6,
    } as ViewStyle,
    scopeRow: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 2,
    } as ViewStyle,
    scopePill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    } as ViewStyle,
    scopePillText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    emptyPrompt: {
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    emptyPromptText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    } as TextStyle,
    resultItem: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
    } as ViewStyle,
    breadcrumbRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 6,
    } as ViewStyle,
    breadcrumbText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    } as TextStyle,
    breadcrumbSep: {
      fontSize: 11,
      fontWeight: '600',
    } as TextStyle,
    resultTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    } as TextStyle,
    resultSnippet: {
      fontSize: 13,
      lineHeight: 18,
    } as TextStyle,
  });
}
