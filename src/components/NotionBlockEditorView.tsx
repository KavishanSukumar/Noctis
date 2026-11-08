import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
  ViewStyle,
  TextStyle,
  StyleProp,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlockItem, BlockFormattingStyle } from '../models/NoctisModels';
import { NoctisTheme, ColorPaletteDefinition } from '../theme/NoctisTheme';
import { InputSanitizer } from '../security/InputSanitizer';

export class NotionBlockEditorViewProps {
  public blocks: BlockItem[] = [];
  public isDark: boolean = true;
  public palette?: ColorPaletteDefinition;
  public readOnly?: boolean = false;
  public scrollEnabled?: boolean = true;
  public onBlocksChange: (updated: BlockItem[]) => void = () => {};
  public onWikiLinkPress?: (linkTitle: string) => void = () => {};
  public onBlockFocus?: (blockIndex: number, blockId: string) => void = () => {};
}

export class RecentlyDeletedBlock {
  public block: BlockItem;
  public index: number;

  constructor(block: BlockItem, index: number) {
    this.block = block;
    this.index = index;
  }
}

export class NotionBlockEditorViewState {
  public showCommandMenu: boolean = false;
  public commandMenuFromSlash: boolean = false;
  public activeBlockId: string | null = null;
  public showColorPicker: boolean = false;
  public recentlyDeleted: RecentlyDeletedBlock | null = null;
  public isKeyboardVisible: boolean = false;
  public keyboardHeight: number = 0;
}

export class QuickInsertChipOption {
  public type: BlockItem['type'] = 'text';
  public label: string = '';
  public accent?: boolean = false;

  constructor(type: BlockItem['type'], label: string, accent: boolean = false) {
    this.type = type;
    this.label = label;
    this.accent = accent;
  }
}

class BlockVisualConfig {
  public containerStyle: StyleProp<ViewStyle> = null;
  public prefix: React.ReactNode = null;
  public textStyle: StyleProp<TextStyle> = null;
  public placeholder: string = '';
  public label: string = 'Text';
}

class BlockTypeOption {
  public type: BlockItem['type'];
  public label: string;
  public icon: string;

  constructor(type: BlockItem['type'], label: string, icon: string) {
    this.type = type;
    this.label = label;
    this.icon = icon;
  }
}

export class NotionBlockEditorView extends React.Component<
  NotionBlockEditorViewProps,
  NotionBlockEditorViewState
> {
  private static readonly LIST_TYPES: readonly BlockItem['type'][] = ['bullet', 'numbered', 'todo'];
  private static readonly UNDO_WINDOW_MS: number = 5000;
  private static readonly TYPE_OPTIONS: readonly BlockTypeOption[] = [
    new BlockTypeOption('text', 'Plain Text', '¶'),
    new BlockTypeOption('heading1', 'Large Title', 'H1'),
    new BlockTypeOption('heading2', 'Section Heading', 'H2'),
    new BlockTypeOption('bullet', 'Bullet List', '•'),
    new BlockTypeOption('numbered', 'Numbered List', '1.'),
    new BlockTypeOption('todo', 'To-Do Checklist', '☑'),
    new BlockTypeOption('callout', 'Highlight Box', '💡'),
    new BlockTypeOption('quote', 'Quote', '❝'),
    new BlockTypeOption('code', 'Framed Note', '📝'),
    new BlockTypeOption('divider', 'Divider Line', '―'),
  ];

  private styles = NotionBlockEditorViewStyles.styles;
  private inputRefs: Map<string, any> = new Map();
  private pendingFocusId: string | null = null;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private keyboardShowSub: { remove: () => void } | null = null;
  private keyboardHideSub: { remove: () => void } | null = null;

  constructor(props: NotionBlockEditorViewProps) {
    super(props);
    this.state = {
      showCommandMenu: false,
      commandMenuFromSlash: false,
      activeBlockId: null,
      showColorPicker: false,
      recentlyDeleted: null,
      isKeyboardVisible: false,
      keyboardHeight: 0,
    };
  }

  public override componentDidMount(): void {
    const onShow = (e: any) => {
      this.setState({ isKeyboardVisible: true, keyboardHeight: e?.endCoordinates?.height || 300 });
    };
    const onHide = () => {
      this.setState({ isKeyboardVisible: false, keyboardHeight: 0 });
    };
    this.keyboardShowSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    this.keyboardHideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
  }

  public override componentDidUpdate(): void {
    this.flushPendingFocus();
  }

  public override componentWillUnmount(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    if (this.keyboardShowSub) {
      this.keyboardShowSub.remove();
      this.keyboardShowSub = null;
    }
    if (this.keyboardHideSub) {
      this.keyboardHideSub.remove();
      this.keyboardHideSub = null;
    }
    this.inputRefs.clear();
    this.pendingFocusId = null;
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private flushPendingFocus = (): void => {
    if (!this.pendingFocusId) return;
    const ref = this.inputRefs.get(this.pendingFocusId);
    if (ref) {
      this.pendingFocusId = null;
      ref.focus();
    }
  };

  private registerInputRef = (id: string, ref: any): void => {
    if (ref) {
      this.inputRefs.set(id, ref);
    } else {
      this.inputRefs.delete(id);
    }
  };

  private generateBlockId = (): string =>
    `blk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  private createBlock = (type: BlockItem['type'], content: string = ''): BlockItem =>
    new BlockItem({
      id: this.generateBlockId(),
      type,
      content,
      checked: false,
      style: new BlockFormattingStyle(),
    });

  /** Immutable clone – never mutate block objects owned by the parent state. */
  private cloneBlock = (block: BlockItem, patch: Partial<BlockItem>): BlockItem =>
    new BlockItem({ ...block, ...patch, updatedAt: Date.now() });

  private replaceBlockAt = (index: number, patch: Partial<BlockItem>): BlockItem[] =>
    this.props.blocks.map((b, i) => (i === index ? this.cloneBlock(b, patch) : b));

  private emitChange = (updated: BlockItem[]): void => {
    if (this.props.readOnly) return;
    this.props.onBlocksChange(updated);
  };

  private getActiveIndex = (): number => {
    const id = this.state.activeBlockId;
    if (!id) return -1;
    return this.props.blocks.findIndex((b) => b.id === id);
  };

  private isListType = (type: BlockItem['type']): boolean => NotionBlockEditorView.LIST_TYPES.includes(type);

  /** Consecutive numbered blocks count 1, 2, 3… and restart after any other block type. */
  private computeListNumbers = (): number[] => {
    let counter = 0;
    return this.props.blocks.map((b) => {
      if (b.type === 'numbered') {
        counter += 1;
        return counter;
      }
      counter = 0;
      return 0;
    });
  };

  private closeMenus = (): Partial<NotionBlockEditorViewState> => ({
    showCommandMenu: false,
    commandMenuFromSlash: false,
    showColorPicker: false,
  });

  // ───────────────────────────── Editing actions ─────────────────────────────

  private handleFocus = (blockId: string): void => {
    const idx = this.props.blocks.findIndex((b) => b.id === blockId);
    if (idx !== -1 && this.props.onBlockFocus) {
      this.props.onBlockFocus(idx, blockId);
    }
    if (this.state.activeBlockId === blockId) return;
    this.setState({ activeBlockId: blockId, ...this.closeMenus() } as NotionBlockEditorViewState);
  };

  private handleContentChange = (index: number, rawText: string): void => {
    if (this.props.readOnly) return;
    const block = this.props.blocks[index];
    if (!block) return;

    const previous = block.content || '';
    const text = InputSanitizer.sanitizeInputContent(rawText);
    const isSingleAppend = text.length === previous.length + 1 && text.startsWith(previous);

    // Smart Enter: lists continue / exit, headings drop into a fresh paragraph
    if (isSingleAppend && text.endsWith('\n')) {
      if (this.isListType(block.type)) {
        if (previous.trim() === '') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          this.emitChange(this.replaceBlockAt(index, { type: 'text', content: '', checked: false }));
          return;
        }
        this.splitIntoNewBlock(index, previous, block.type);
        return;
      }
      if (block.type === 'heading1' || block.type === 'heading2') {
        this.splitIntoNewBlock(index, previous, 'text');
        return;
      }
    }

    // Slash menu only when "/" typed at the start of a block or after whitespace
    const typedSlash = isSingleAppend && text.endsWith('/') && (previous === '' || /\s$/.test(previous));

    if (typedSlash) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      this.setState({
        showCommandMenu: true,
        commandMenuFromSlash: true,
        showColorPicker: false,
        activeBlockId: block.id,
      });
    } else if (this.state.showCommandMenu && this.state.commandMenuFromSlash && !text.endsWith('/')) {
      this.setState({ showCommandMenu: false, commandMenuFromSlash: false });
    }

    this.emitChange(this.replaceBlockAt(index, { content: text }));
  };

  private splitIntoNewBlock = (index: number, keepContent: string, newType: BlockItem['type']): void => {
    const newBlock = this.createBlock(newType);
    const updated = this.replaceBlockAt(index, { content: keepContent });
    updated.splice(index + 1, 0, newBlock);
    this.pendingFocusId = newBlock.id;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ activeBlockId: newBlock.id, ...this.closeMenus() } as NotionBlockEditorViewState);
    this.emitChange(updated);
  };

  private handleKeyPress = (index: number, e: NativeSyntheticEvent<{ key: string }>): void => {
    if (this.props.readOnly || e.nativeEvent.key !== 'Backspace') return;
    const block = this.props.blocks[index];
    if (!block || block.content !== '') return;

    // Empty styled block → revert to plain text first (keeps focus, no remount)
    if (block.type !== 'text') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      this.emitChange(this.replaceBlockAt(index, { type: 'text', checked: false }));
      return;
    }

    if (this.props.blocks.length <= 1) return;

    // Empty paragraph → remove and jump to previous editable block
    let prevId: string | null = null;
    for (let i = index - 1; i >= 0; i--) {
      if (this.props.blocks[i].type !== 'divider') {
        prevId = this.props.blocks[i].id;
        break;
      }
    }
    const updated = this.props.blocks.filter((_, i) => i !== index);
    this.pendingFocusId = prevId;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ activeBlockId: prevId, ...this.closeMenus() } as NotionBlockEditorViewState);
    this.emitChange(updated);
  };

  private toggleTodo = (index: number): void => {
    const block = this.props.blocks[index];
    if (!block) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Checking items off is intentionally allowed in Reading mode as well
    this.props.onBlocksChange(this.replaceBlockAt(index, { checked: !block.checked }));
  };

  /** Inserts after the focused block (or at the end) and focuses the new block. */
  private insertBlockAfterActive = (type: BlockItem['type']): void => {
    if (this.props.readOnly) return;
    const activeIdx = this.getActiveIndex();
    const insertAt = activeIdx >= 0 ? activeIdx + 1 : this.props.blocks.length;
    const updated = [...this.props.blocks];
    const newBlock = this.createBlock(type);
    updated.splice(insertAt, 0, newBlock);

    let focusTarget = newBlock;
    if (type === 'divider') {
      const follow = this.createBlock('text');
      updated.splice(insertAt + 1, 0, follow);
      focusTarget = follow;
    }

    this.pendingFocusId = focusTarget.id;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ activeBlockId: focusTarget.id, ...this.closeMenus() } as NotionBlockEditorViewState);
    this.emitChange(updated);
  };

  /** Toolbar "turn into" toggle: converts the focused block, or inserts a new one if none is focused. */
  private convertActiveBlock = (type: BlockItem['type']): void => {
    const idx = this.getActiveIndex();
    if (idx < 0) {
      this.insertBlockAfterActive(type);
      return;
    }
    const block = this.props.blocks[idx];
    const nextType: BlockItem['type'] = block.type === type ? 'text' : type;
    Haptics.selectionAsync();
    this.pendingFocusId = block.id;
    this.emitChange(this.replaceBlockAt(idx, { type: nextType, checked: nextType === 'todo' ? block.checked : false }));
  };

  private selectBlockType = (type: BlockItem['type']): void => {
    const idx = this.getActiveIndex();
    if (idx < 0) {
      this.setState(this.closeMenus() as NotionBlockEditorViewState);
      return;
    }
    const block = this.props.blocks[idx];
    let content = block.content || '';
    if (this.state.commandMenuFromSlash && content.endsWith('/')) {
      content = content.slice(0, -1);
    }

    let updated: BlockItem[];
    let focusId: string = block.id;

    if (type === 'divider') {
      updated = [...this.props.blocks];
      const follow = this.createBlock('text');
      if (content.trim() !== '') {
        // Keep the user's text; place the divider underneath it
        updated[idx] = this.cloneBlock(block, { content });
        updated.splice(idx + 1, 0, this.createBlock('divider'), follow);
      } else {
        updated[idx] = this.cloneBlock(block, { type: 'divider', content: '' });
        updated.splice(idx + 1, 0, follow);
      }
      focusId = follow.id;
    } else {
      updated = this.replaceBlockAt(idx, { type, content, checked: type === 'todo' ? block.checked : false });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.pendingFocusId = focusId;
    this.setState({ activeBlockId: focusId, ...this.closeMenus() } as NotionBlockEditorViewState);
    this.emitChange(updated);
  };

  private openTypeMenu = (): void => {
    if (this.getActiveIndex() < 0) return;
    Haptics.selectionAsync();
    this.setState({
      showCommandMenu: !this.state.showCommandMenu,
      commandMenuFromSlash: false,
      showColorPicker: false,
    });
  };

  private cancelCommandMenu = (): void => {
    const idx = this.getActiveIndex();
    if (idx >= 0) this.pendingFocusId = this.props.blocks[idx].id;
    this.setState(this.closeMenus() as NotionBlockEditorViewState, this.flushPendingFocus);
  };

  private toggleActiveStyle = (styleProp: 'bold' | 'italic' | 'underline' | 'strikethrough'): void => {
    const idx = this.getActiveIndex();
    if (idx < 0) return;
    const block = this.props.blocks[idx];
    const currentStyle = block.style || new BlockFormattingStyle();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.emitChange(
      this.replaceBlockAt(idx, {
        style: new BlockFormattingStyle({ ...currentStyle, [styleProp]: !currentStyle[styleProp] }),
      })
    );
  };

  private applyColorToActiveBlock = (hex: string): void => {
    const idx = this.getActiveIndex();
    if (idx < 0) return;
    const block = this.props.blocks[idx];
    const currentStyle = block.style || new BlockFormattingStyle();
    const safeHex = InputSanitizer.sanitizeColorHex(hex, '');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ showColorPicker: false });
    this.emitChange(
      this.replaceBlockAt(idx, {
        style: new BlockFormattingStyle({ ...currentStyle, textColor: safeHex || undefined }),
      })
    );
  };

  private deleteBlock = (index: number): void => {
    if (this.props.readOnly) return;
    const block = this.props.blocks[index];
    if (!block) return;

    // Last remaining block: clear it instead of silently doing nothing
    if (this.props.blocks.length <= 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      this.emitChange([
        this.cloneBlock(block, { type: 'text', content: '', checked: false, style: new BlockFormattingStyle() }),
      ]);
      return;
    }

    const updated = this.props.blocks.filter((_, i) => i !== index);
    const worthUndo = block.type === 'divider' || (block.content || '').trim().length > 0;

    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    if (worthUndo) {
      this.undoTimer = setTimeout(() => {
        this.undoTimer = null;
        this.setState({ recentlyDeleted: null });
      }, NotionBlockEditorView.UNDO_WINDOW_MS);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    this.setState({
      activeBlockId: null,
      ...this.closeMenus(),
      recentlyDeleted: worthUndo ? new RecentlyDeletedBlock(block, index) : null,
    } as NotionBlockEditorViewState);
    this.emitChange(updated);
  };

  private undoDelete = (): void => {
    const deleted = this.state.recentlyDeleted;
    if (!deleted) return;
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    const updated = [...this.props.blocks];
    updated.splice(Math.min(deleted.index, updated.length), 0, deleted.block);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.setState({ recentlyDeleted: null, activeBlockId: deleted.block.id });
    this.emitChange(updated);
  };

  private finishEditing = (): void => {
    Keyboard.dismiss();
    this.setState({ activeBlockId: null, ...this.closeMenus() } as NotionBlockEditorViewState);
  };

  // ───────────────────────────── Rendering ─────────────────────────────

  /**
   * Only emits keys the user explicitly enabled so type-specific defaults
   * (bold headings, muted/struck-through completed to-dos) are not overridden.
   */
  private getComputedTextStyle = (block: BlockItem): TextStyle => {
    const s = block.style || new BlockFormattingStyle();
    let textDecorationLine: TextStyle['textDecorationLine'] = undefined;
    if (s.underline && s.strikethrough) {
      textDecorationLine = 'underline line-through';
    } else if (s.underline) {
      textDecorationLine = 'underline';
    } else if (s.strikethrough) {
      textDecorationLine = 'line-through';
    }

    return {
      fontWeight: s.bold ? '700' : undefined,
      fontStyle: s.italic ? 'italic' : undefined,
      textDecorationLine,
      color: s.textColor && !(block.type === 'todo' && block.checked) ? s.textColor : undefined,
    };
  };

  private getBlockVisualConfig = (
    block: BlockItem,
    index: number,
    palette: ColorPaletteDefinition,
    listNumber: number,
    isActive: boolean
  ): BlockVisualConfig => {
    const cfg = new BlockVisualConfig();
    const s = this.styles;

    switch (block.type) {
      case 'heading1':
        cfg.containerStyle = s.plainContainer;
        cfg.textStyle = [s.h1Text, { color: palette.textPrimary }];
        cfg.placeholder = 'Large Title';
        cfg.label = 'Large title';
        break;
      case 'heading2':
        cfg.containerStyle = s.plainContainer;
        cfg.textStyle = [s.h2Text, { color: palette.textPrimary }];
        cfg.placeholder = 'Section Heading';
        cfg.label = 'Section heading';
        break;
      case 'bullet':
        cfg.containerStyle = s.plainContainer;
        cfg.prefix = <Text style={[s.bulletDot, { color: palette.accent }]}>•</Text>;
        cfg.textStyle = [s.bodyText, { color: palette.textPrimary }];
        cfg.placeholder = 'List item';
        cfg.label = 'Bullet item';
        break;
      case 'numbered':
        cfg.containerStyle = s.plainContainer;
        cfg.prefix = <Text style={[s.numberedPrefix, { color: palette.accent }]}>{listNumber || 1}.</Text>;
        cfg.textStyle = [s.bodyText, { color: palette.textPrimary }];
        cfg.placeholder = 'List item';
        cfg.label = `Numbered item ${listNumber || 1}`;
        break;
      case 'todo':
        cfg.containerStyle = s.plainContainer;
        cfg.prefix = (
          <TouchableOpacity
            onPress={() => this.toggleTodo(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!block.checked }}
            accessibilityLabel={block.checked ? 'Mark as not done' : 'Mark as done'}
            style={[
              s.checkbox,
              {
                borderColor: block.checked ? palette.accent : palette.border,
                backgroundColor: block.checked ? palette.accent : 'transparent',
              },
            ]}
          >
            {block.checked && <Text style={[s.checkmark, { color: palette.accentContrast }]}>✓</Text>}
          </TouchableOpacity>
        );
        cfg.textStyle = [
          s.bodyText,
          {
            color: block.checked ? palette.textMuted : palette.textPrimary,
            textDecorationLine: block.checked ? 'line-through' : 'none',
          },
        ];
        cfg.placeholder = 'To-do';
        cfg.label = 'To-do item';
        break;
      case 'quote':
        cfg.containerStyle = [s.quoteContainer, { borderLeftColor: palette.accent, backgroundColor: palette.cardBackground }];
        cfg.textStyle = [s.quoteText, { color: palette.textSecondary }];
        cfg.placeholder = 'Quote or takeaway';
        cfg.label = 'Quote';
        break;
      case 'callout':
        cfg.containerStyle = [s.calloutContainer, { backgroundColor: palette.calloutBg, borderColor: palette.cardBorder }];
        cfg.prefix = <Text style={s.calloutIcon}>💡</Text>;
        cfg.textStyle = [s.calloutText, { color: palette.textPrimary }];
        cfg.placeholder = 'Important thought or insight';
        cfg.label = 'Highlight box';
        break;
      case 'code':
        cfg.containerStyle = [s.codeContainer, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }];
        cfg.textStyle = [s.codeText, { color: palette.accent }];
        cfg.placeholder = 'Framed note';
        cfg.label = 'Framed note';
        break;
      case 'text':
      default:
        cfg.containerStyle = s.plainContainer;
        cfg.textStyle = [s.bodyText, { color: palette.textPrimary }];
        cfg.placeholder = isActive ? "Type something, or '/' for block types" : 'Write something…';
        cfg.label = 'Text';
        break;
    }
    return cfg;
  };

  private renderBlockContent = (
    block: BlockItem,
    index: number,
    palette: ColorPaletteDefinition,
    listNumber: number,
    isActive: boolean
  ): React.ReactNode => {
    const isReadOnly = !!this.props.readOnly;

    if (block.type === 'divider') {
      const line = <View style={[this.styles.dividerLine, { backgroundColor: palette.divider }]} />;
      if (isReadOnly) return line;
      return (
        <TouchableOpacity
          onPress={() => this.handleFocus(block.id)}
          accessibilityRole="button"
          accessibilityLabel="Divider line. Tap to select"
          style={this.styles.dividerTouch}
        >
          {line}
        </TouchableOpacity>
      );
    }

    const cfg = this.getBlockVisualConfig(block, index, palette, listNumber, isActive);
    const customTextStyle = this.getComputedTextStyle(block);

    // Identical structure (container → [prefix, field]) for every type so changing a
    // block's type never remounts the TextInput and the keyboard stays open.
    return (
      <View style={cfg.containerStyle}>
        {cfg.prefix}
        {isReadOnly ? (
          <Text style={[this.styles.fieldBase, cfg.textStyle, customTextStyle]}>
            {block.type === 'quote' && block.content ? `"${block.content}"` : block.content || ' '}
          </Text>
        ) : (
          <TextInput
            ref={(r) => {
              this.registerInputRef(block.id, r);
            }}
            multiline
            scrollEnabled={false}
            maxLength={InputSanitizer.MAX_BLOCK_CONTENT_LENGTH}
            onFocus={() => this.handleFocus(block.id)}
            onKeyPress={(e) => this.handleKeyPress(index, e)}
            style={[this.styles.fieldBase, cfg.textStyle, customTextStyle]}
            value={block.content}
            onChangeText={(txt) => this.handleContentChange(index, txt)}
            placeholder={cfg.placeholder}
            placeholderTextColor={palette.textMuted}
            accessibilityLabel={`${cfg.label} block`}
            textAlignVertical="top"
          />
        )}
      </View>
    );
  };

  private renderToolButton = (
    key: string,
    label: string,
    a11yLabel: string,
    onPress: () => void,
    palette: ColorPaletteDefinition,
    options: { selected?: boolean; disabled?: boolean; textStyle?: TextStyle } = {}
  ): React.ReactNode => {
    const { selected = false, disabled = false, textStyle } = options;
    return (
      <TouchableOpacity
        key={key}
        onPress={onPress}
        disabled={disabled}
        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ selected, disabled }}
        style={[
          this.styles.toolbarBtn,
          selected && { backgroundColor: palette.accent },
          disabled && this.styles.toolbarBtnDisabled,
        ]}
      >
        <Text style={[this.styles.toolbarBtnText, { color: selected ? palette.accentContrast : palette.textPrimary }, textStyle]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  private renderFormattingToolbar = (palette: ColorPaletteDefinition, block: BlockItem | null): React.ReactNode => {
    const disabled = !block;
    const st = block?.style || new BlockFormattingStyle();
    const type = block?.type;
    const sep = (k: string) => <View key={k} style={[this.styles.toolbarSeparator, { backgroundColor: palette.glassBorder }]} />;

    return (
      <View style={[this.styles.richToolbar, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={this.styles.richToolbarContent}
        >
          {this.renderToolButton('b', 'B', 'Bold', () => this.toggleActiveStyle('bold'), palette, { selected: !!st.bold, disabled, textStyle: { fontWeight: '800' } })}
          {this.renderToolButton('i', 'I', 'Italic', () => this.toggleActiveStyle('italic'), palette, { selected: !!st.italic, disabled, textStyle: { fontStyle: 'italic' } })}
          {this.renderToolButton('u', 'U', 'Underline', () => this.toggleActiveStyle('underline'), palette, { selected: !!st.underline, disabled, textStyle: { textDecorationLine: 'underline' } })}
          {this.renderToolButton('s', 'S', 'Strikethrough', () => this.toggleActiveStyle('strikethrough'), palette, { selected: !!st.strikethrough, disabled, textStyle: { textDecorationLine: 'line-through' } })}
          <TouchableOpacity
            key="color"
            onPress={() => this.setState({ showColorPicker: !this.state.showColorPicker, showCommandMenu: false })}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Text colour"
            accessibilityState={{ selected: this.state.showColorPicker, disabled }}
            style={[this.styles.toolbarBtn, disabled && this.styles.toolbarBtnDisabled, this.state.showColorPicker && { backgroundColor: palette.surfaceElevated }]}
          >
            <View style={[this.styles.colorIndicator, { backgroundColor: st.textColor || palette.textPrimary, borderColor: palette.glassBorder }]} />
          </TouchableOpacity>
          {sep('sep1')}
          {this.renderToolButton('h1', 'H1', 'Turn into large title', () => this.convertActiveBlock('heading1'), palette, { selected: type === 'heading1', textStyle: { fontWeight: '800' } })}
          {this.renderToolButton('h2', 'H2', 'Turn into section heading', () => this.convertActiveBlock('heading2'), palette, { selected: type === 'heading2', textStyle: { fontWeight: '700' } })}
          {this.renderToolButton('bullet', '•', 'Turn into bullet list', () => this.convertActiveBlock('bullet'), palette, { selected: type === 'bullet', textStyle: { fontSize: 18 } })}
          {this.renderToolButton('num', '1.', 'Turn into numbered list', () => this.convertActiveBlock('numbered'), palette, { selected: type === 'numbered' })}
          {this.renderToolButton('todo', '☑', 'Turn into checklist', () => this.convertActiveBlock('todo'), palette, { selected: type === 'todo', textStyle: { fontSize: 15 } })}
          {this.renderToolButton('quote', '❝', 'Turn into quote', () => this.convertActiveBlock('quote'), palette, { selected: type === 'quote', textStyle: { fontSize: 15 } })}
          {this.renderToolButton('callout', '💡', 'Turn into highlight box', () => this.convertActiveBlock('callout'), palette, { selected: type === 'callout' })}
          {this.renderToolButton('more', '⋯', 'More block types', this.openTypeMenu, palette, { selected: this.state.showCommandMenu, disabled, textStyle: { fontSize: 16, fontWeight: '800' } })}
          {sep('sep2')}
          {this.renderToolButton('done', 'Done', 'Finish editing and hide keyboard', this.finishEditing, palette, { disabled, textStyle: { color: palette.accent, fontWeight: '700' } })}
        </ScrollView>
      </View>
    );
  };

  private renderColorPicker = (palette: ColorPaletteDefinition, block: BlockItem | null): React.ReactNode => {
    const current = block?.style?.textColor || '';
    return (
      <View style={[this.styles.colorPickerRow, { backgroundColor: palette.surfaceElevated, borderColor: palette.glassBorder }]}>
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={this.styles.colorPickerContent}>
          {NoctisTheme.TEXT_COLORS.map((col) => {
            const selected = current === col.hex;
            return (
              <TouchableOpacity
                key={col.name}
                onPress={() => this.applyColorToActiveBlock(col.hex)}
                accessibilityRole="button"
                accessibilityLabel={`${col.name} text colour`}
                accessibilityState={{ selected }}
                style={this.styles.colorOption}
              >
                <View
                  style={[
                    this.styles.colorDot,
                    { backgroundColor: col.hex || palette.textPrimary, borderColor: selected ? palette.accent : 'transparent' },
                  ]}
                />
                <Text style={[this.styles.colorName, { color: selected ? palette.accent : palette.textMuted }]} numberOfLines={1}>
                  {col.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  private renderCommandMenu = (palette: ColorPaletteDefinition, block: BlockItem): React.ReactNode => (
    <View style={[this.styles.commandMenu, { borderColor: palette.glassBorder, backgroundColor: palette.surfaceElevated }]}>
      <View style={this.styles.commandHeaderRow}>
        <Text style={[this.styles.commandHeader, { color: palette.accent }]}>TURN THIS LINE INTO</Text>
        <TouchableOpacity
          onPress={this.cancelCommandMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[this.styles.commandCancel, { color: palette.textSecondary }]}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={this.styles.commandGrid}>
        {NotionBlockEditorView.TYPE_OPTIONS.map((opt) => {
          const selected = block.type === opt.type;
          return (
            <TouchableOpacity
              key={opt.type}
              onPress={() => this.selectBlockType(opt.type)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
              style={[
                this.styles.commandOption,
                { borderColor: selected ? palette.accent : palette.glassBorder, backgroundColor: selected ? palette.calloutBg : 'transparent' },
              ]}
            >
              <Text style={[this.styles.commandIcon, { color: palette.accent }]}>{opt.icon}</Text>
              <Text style={[this.styles.commandLabel, { color: palette.textPrimary }]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  private renderUndoPill = (palette: ColorPaletteDefinition): React.ReactNode => (
    <View style={[this.styles.undoPill, { backgroundColor: palette.surfaceElevated, borderColor: palette.glassBorder }]}>
      <Text style={[this.styles.undoText, { color: palette.textSecondary }]}>Block deleted</Text>
      <TouchableOpacity
        onPress={this.undoDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Undo delete"
      >
        <Text style={[this.styles.undoAction, { color: palette.accent }]}>↶ Undo</Text>
      </TouchableOpacity>
    </View>
  );

  private renderQuickInsertChips = (palette: ColorPaletteDefinition): React.ReactNode => {
    const chips: QuickInsertChipOption[] = [
      new QuickInsertChipOption('text', '+ Text'),
      new QuickInsertChipOption('heading2', '+ Heading'),
      new QuickInsertChipOption('todo', '+ ☑ Checklist', true),
      new QuickInsertChipOption('bullet', '+ • Bullet'),
      new QuickInsertChipOption('callout', '+ 💡 Callout'),
      new QuickInsertChipOption('quote', '+ ❝ Quote'),
      new QuickInsertChipOption('divider', '+ ― Divider'),
    ];
    const hasActive = this.getActiveIndex() >= 0;
    return (
      <View style={this.styles.quickInsertSection}>
        <Text style={[this.styles.quickInsertLabel, { color: palette.textMuted }]}>
          {hasActive ? 'ADD BELOW SELECTED LINE' : 'ADD A BLOCK'}
        </Text>
        <View style={this.styles.toolbarRow}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.type}
              onPress={() => this.insertBlockAfterActive(chip.type)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${chip.label.replace(/^\+\s*/, '')} block`}
              style={[this.styles.toolChip, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}
            >
              <Text style={[this.styles.toolChipText, { color: chip.accent ? palette.accent : palette.textPrimary }]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  private renderBlocksList = (palette: ColorPaletteDefinition, embedded: boolean): React.ReactNode => {
    const isReadOnly = !!this.props.readOnly;
    const numbers = this.computeListNumbers();
    const deleted = this.state.recentlyDeleted;
    const blocks = this.props.blocks;

    return (
      <>
        {blocks.map((block, index) => {
          const isActive = !isReadOnly && this.state.activeBlockId === block.id;
          return (
            <React.Fragment key={block.id}>
              {!isReadOnly && deleted && deleted.index === index && this.renderUndoPill(palette)}
              <View
                style={[
                  this.styles.blockRow,
                  isActive && { backgroundColor: palette.glassElevated, borderLeftColor: palette.accent },
                ]}
              >
                <View style={this.styles.blockContent}>
                  {this.renderBlockContent(block, index, palette, numbers[index], isActive)}
                </View>
                {isActive && (
                  <TouchableOpacity
                    onPress={() => this.deleteBlock(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[this.styles.deleteBtn, { backgroundColor: palette.surfaceElevated, borderColor: palette.glassBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this block"
                  >
                    <Text style={[this.styles.deleteIcon, { color: palette.danger }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isActive && embedded && this.renderFormattingToolbar(palette, block)}
              {isActive && embedded && this.state.showColorPicker && this.renderColorPicker(palette, block)}
              {isActive && this.state.showCommandMenu && this.renderCommandMenu(palette, block)}
            </React.Fragment>
          );
        })}
        {!isReadOnly && deleted && deleted.index >= blocks.length && this.renderUndoPill(palette)}
        {!isReadOnly && this.renderQuickInsertChips(palette)}
      </>
    );
  };

  public override render() {
    const palette = this.props.palette || NoctisTheme.getColors(this.props.isDark);
    const isReadOnly = !!this.props.readOnly;
    const embedded = this.props.scrollEnabled === false;
    const activeIdx = this.getActiveIndex();
    const activeBlock = activeIdx >= 0 ? this.props.blocks[activeIdx] : null;

    return (
      <View style={embedded ? this.styles.embeddedContainer : this.styles.container}>
        {/* Standalone mode: formatting toolbar pinned on top */}
        {!isReadOnly && !embedded && this.renderFormattingToolbar(palette, activeBlock)}
        {!isReadOnly && !embedded && this.state.showColorPicker && this.renderColorPicker(palette, activeBlock)}

        {/* Embedded mode: helpful hint until a line is selected (toolbar then appears under it) */}
        {!isReadOnly && embedded && !activeBlock && (
          <View style={[this.styles.hintRow, { backgroundColor: palette.glassElevated, borderColor: palette.glassBorder }]}>
            <Text style={[this.styles.hintText, { color: palette.textSecondary }]}>
              ✏️ Tap any line to write · formatting tools appear under it · type <Text style={{ color: palette.accent, fontWeight: '700' }}>/</Text> for block types
            </Text>
          </View>
        )}

        {embedded ? (
          <View style={this.styles.nestedBlockContainer}>{this.renderBlocksList(palette, embedded)}</View>
        ) : (
          <ScrollView
            style={this.styles.scrollView}
            contentContainerStyle={[
              this.styles.scrollContent,
              {
                paddingBottom: this.state.isKeyboardVisible
                  ? this.state.keyboardHeight + 100
                  : 60,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            showsVerticalScrollIndicator={false}
          >
            {this.renderBlocksList(palette, embedded)}
          </ScrollView>
        )}
      </View>
    );
  }
}

export class NotionBlockEditorViewStyles {
  public static readonly styles = StyleSheet.create({
    container: {
      flex: 1,
    } as ViewStyle,
    embeddedContainer: {} as ViewStyle,
    richToolbar: {
      borderWidth: 1,
      borderRadius: 14,
      marginTop: 4,
      marginBottom: 8,
      overflow: 'hidden',
    } as ViewStyle,
    richToolbarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 4,
      gap: 2,
    } as ViewStyle,
    toolbarBtn: {
      minWidth: 40,
      minHeight: 40,
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 10,
    } as ViewStyle,
    toolbarBtnDisabled: {
      opacity: 0.35,
    } as ViewStyle,
    toolbarBtnText: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    toolbarSeparator: {
      width: 1,
      height: 22,
      marginHorizontal: 4,
    } as ViewStyle,
    colorIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
    } as ViewStyle,
    colorPickerRow: {
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: 8,
    } as ViewStyle,
    colorPickerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 6,
    } as ViewStyle,
    colorOption: {
      alignItems: 'center',
      minWidth: 52,
      paddingVertical: 2,
    } as ViewStyle,
    colorDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2.5,
    } as ViewStyle,
    colorName: {
      fontSize: 10,
      marginTop: 4,
      fontWeight: '600',
    } as TextStyle,
    hintRow: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 16,
      marginTop: 10,
    } as ViewStyle,
    hintText: {
      fontSize: 12,
      lineHeight: 18,
    } as TextStyle,
    scrollView: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: 40,
    } as ViewStyle,
    nestedBlockContainer: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    } as ViewStyle,
    blockRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
      borderRadius: 10,
      paddingLeft: 6,
      paddingRight: 4,
    } as ViewStyle,
    blockContent: {
      flex: 1,
    } as ViewStyle,
    deleteBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      marginLeft: 6,
      marginTop: 4,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    deleteIcon: {
      fontSize: 18,
      lineHeight: 20,
      fontWeight: '500',
    } as TextStyle,
    plainContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    } as ViewStyle,
    fieldBase: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 8,
    } as TextStyle,
    bodyText: {
      fontSize: 16,
      lineHeight: 24,
    } as TextStyle,
    h1Text: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 32,
      letterSpacing: -0.4,
      paddingVertical: 6,
    } as TextStyle,
    h2Text: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    } as TextStyle,
    bulletDot: {
      fontSize: 18,
      marginRight: 8,
      lineHeight: 32,
    } as TextStyle,
    numberedPrefix: {
      fontSize: 15,
      fontWeight: '700',
      marginRight: 8,
      lineHeight: 32,
      minWidth: 18,
    } as TextStyle,
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      marginRight: 10,
      marginTop: 5,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    checkmark: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '800',
    } as TextStyle,
    quoteContainer: {
      flexDirection: 'row',
      borderLeftWidth: 3,
      paddingLeft: 14,
      marginVertical: 4,
      borderRadius: 4,
      paddingVertical: 4,
    } as ViewStyle,
    quoteText: {
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 24,
    } as TextStyle,
    calloutContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginVertical: 6,
    } as ViewStyle,
    calloutIcon: {
      fontSize: 18,
      marginRight: 10,
      marginTop: 4,
    } as TextStyle,
    calloutText: {
      fontSize: 15,
      lineHeight: 22,
    } as TextStyle,
    codeContainer: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 6,
    } as ViewStyle,
    codeText: {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 20,
    } as TextStyle,
    dividerTouch: {
      paddingVertical: 6,
    } as ViewStyle,
    dividerLine: {
      height: 1,
      width: '100%',
      marginVertical: 12,
    } as ViewStyle,
    commandMenu: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 12,
      marginBottom: 10,
    } as ViewStyle,
    commandHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingHorizontal: 4,
    } as ViewStyle,
    commandHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    } as TextStyle,
    commandCancel: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    commandGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    } as ViewStyle,
    commandOption: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      minHeight: 42,
      flexBasis: '48%',
      flexGrow: 1,
    } as ViewStyle,
    commandIcon: {
      fontSize: 14,
      fontWeight: '800',
      width: 26,
      textAlign: 'center',
      marginRight: 6,
    } as TextStyle,
    commandLabel: {
      fontSize: 14,
      fontWeight: '500',
      flexShrink: 1,
    } as TextStyle,
    undoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginVertical: 6,
    } as ViewStyle,
    undoText: {
      fontSize: 13,
    } as TextStyle,
    undoAction: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    quickInsertSection: {
      marginTop: 14,
      marginBottom: 24,
    } as ViewStyle,
    quickInsertLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 8,
    } as TextStyle,
    toolbarRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    } as ViewStyle,
    toolChip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      minHeight: 38,
      justifyContent: 'center',
    } as ViewStyle,
    toolChipText: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
  });
}
