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
  Linking,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BookItem,
  BookQuoteBlock,
  KnowledgeItem,
  ReferenceLinkItem,
  DailyRecurringTask,
  ProjectItem,
  BrainstormCard,
  BlockFormattingStyle,
} from '../models/NoctisModels';
import { ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { SecondBrainPKMService, DailyTaskStatistics } from '../services/SecondBrainPKMService';
import { DailyDiaryService } from '../services/DailyDiaryService';
import { InputSanitizer } from '../security/InputSanitizer';

export class SecondBrainHubViewProps {
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public isDark: boolean = true;
  public books: BookItem[] = [];
  public knowledgeItems: KnowledgeItem[] = [];
  public referenceLinks: ReferenceLinkItem[] = [];
  public dailyRecurringTasks: DailyRecurringTask[] = [];
  public dailyTaskCompletions: { [dateKey: string]: { [taskId: string]: boolean } } = {};
  public projects: ProjectItem[] = [];
  public onUpdateBooks: (books: BookItem[]) => void = () => {};
  public onUpdateKnowledge: (items: KnowledgeItem[]) => void = () => {};
  public onUpdateLinks: (links: ReferenceLinkItem[]) => void = () => {};
  public onUpdateDailyTasks: (tasks: DailyRecurringTask[]) => void = () => {};
  public onToggleDailyTaskCompletion: (dateKey: string, taskId: string) => void = () => {};
  public onUpdateProjects: (projects: ProjectItem[]) => void = () => {};
  public isKeyboardVisible?: boolean = false;
  public keyboardHeight?: number = 0;
}

export class SecondBrainHubViewState {
  public activeSubTab: 'books' | 'knowledge' | 'links' | 'daily_tasks' | 'projects' = 'books';
  public searchQuery: string = '';
  public selectedBookId: string | null = null;
  public selectedProjectId: string | null = null;
  public selectedDateKey: string = DailyDiaryService.getTodayDateKey();
  public showRoutineManagerList: boolean = false;

  // Create Modals
  public showAddBookModal: boolean = false;
  public showAddBlockModal: boolean = false;
  public showAddKnowledgeModal: boolean = false;
  public showAddLinkModal: boolean = false;
  public showAddDailyTaskModal: boolean = false;
  public showAddProjectModal: boolean = false;
  public showAddCardModal: boolean = false;

  // Edit Modals
  public showEditBookModal: boolean = false;
  public showEditBlockModal: boolean = false;
  public showEditKnowledgeModal: boolean = false;
  public showEditLinkModal: boolean = false;
  public showEditDailyTaskModal: boolean = false;
  public showEditProjectModal: boolean = false;
  public showEditCardModal: boolean = false;

  // Book Form State (Create & Edit)
  public editingBookId: string | null = null;
  public bookTitleInput: string = '';
  public bookAuthorInput: string = '';
  public bookStartDateInput: string = DailyDiaryService.getTodayDateKey();
  public bookFinishDateInput: string = '';
  public bookIsCurrentlyReadingInput: boolean = true;

  // Book Block Form State (Create & Edit)
  public editingBlockId: string | null = null;
  public blockTypeInput: 'quote' | 'note' = 'quote';
  public blockContentInput: string = '';
  public blockChapterInput: string = '';

  // Knowledge Form State (Create & Edit)
  public editingKnowledgeId: string | null = null;
  public knowledgeTopicInput: string = '';
  public knowledgeDescInput: string = '';

  // Link Form State (Create & Edit)
  public editingLinkId: string | null = null;
  public linkTitleInput: string = '';
  public linkDescInput: string = '';
  public linkUrlInput: string = '';

  // Daily Task Form State (Create & Edit)
  public editingDailyTaskId: string | null = null;
  public dailyTaskTitleInput: string = '';
  public dailyTaskNoteInput: string = '';
  public dailyTaskDaysInput: number[] = [1, 2, 3, 4, 5];

  // Project Form State (Create & Edit)
  public editingProjectId: string | null = null;
  public projectNameInput: string = '';
  public projectDescInput: string = '';
  public projectStatusInput: 'active' | 'completed' | 'on_hold' = 'active';

  // Card Form State (Create & Edit)
  public editingCardId: string | null = null;
  public cardTitleInput: string = '';
  public cardContentInput: string = '';
  public cardColorTagInput: string = '#E2A154';
}

export class SecondBrainHubView extends React.Component<
  SecondBrainHubViewProps,
  SecondBrainHubViewState
> {
  private styles = SecondBrainHubViewStyles.styles;
  private readonly DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(props: SecondBrainHubViewProps) {
    super(props);
    this.state = {
      activeSubTab: 'books',
      searchQuery: '',
      selectedBookId: null,
      selectedProjectId: null,
      selectedDateKey: DailyDiaryService.getTodayDateKey(),
      showRoutineManagerList: false,

      showAddBookModal: false,
      showAddBlockModal: false,
      showAddKnowledgeModal: false,
      showAddLinkModal: false,
      showAddDailyTaskModal: false,
      showAddProjectModal: false,
      showAddCardModal: false,

      showEditBookModal: false,
      showEditBlockModal: false,
      showEditKnowledgeModal: false,
      showEditLinkModal: false,
      showEditDailyTaskModal: false,
      showEditProjectModal: false,
      showEditCardModal: false,

      editingBookId: null,
      bookTitleInput: '',
      bookAuthorInput: '',
      bookStartDateInput: DailyDiaryService.getTodayDateKey(),
      bookFinishDateInput: '',
      bookIsCurrentlyReadingInput: true,

      editingBlockId: null,
      blockTypeInput: 'quote',
      blockContentInput: '',
      blockChapterInput: '',

      editingKnowledgeId: null,
      knowledgeTopicInput: '',
      knowledgeDescInput: '',

      editingLinkId: null,
      linkTitleInput: '',
      linkDescInput: '',
      linkUrlInput: '',

      editingDailyTaskId: null,
      dailyTaskTitleInput: '',
      dailyTaskNoteInput: '',
      dailyTaskDaysInput: [1, 2, 3, 4, 5],

      editingProjectId: null,
      projectNameInput: '',
      projectDescInput: '',
      projectStatusInput: 'active',

      editingCardId: null,
      cardTitleInput: '',
      cardContentInput: '',
      cardColorTagInput: '#E2A154',
    };
  }

  // ----------------- HIGHLIGHTING HELPER -----------------
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

  // ----------------- BOOK ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleCreateBook = (): void => {
    if (!this.state.bookTitleInput.trim()) {
      Alert.alert('Required', 'Please enter a book title.');
      return;
    }

    const newBook = SecondBrainPKMService.createNewBook(
      this.state.bookTitleInput,
      this.state.bookAuthorInput,
      this.state.bookStartDateInput,
      this.state.bookFinishDateInput,
      this.state.bookIsCurrentlyReadingInput
    );

    const updated = [newBook, ...this.props.books];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateBooks(updated);
    this.setState({
      showAddBookModal: false,
      bookTitleInput: '',
      bookAuthorInput: '',
      bookFinishDateInput: '',
      bookIsCurrentlyReadingInput: true,
      selectedBookId: newBook.id,
    });
  };

  private openEditBookModal = (book: BookItem): void => {
    this.setState({
      editingBookId: book.id,
      bookTitleInput: book.title,
      bookAuthorInput: book.author,
      bookStartDateInput: book.startDate,
      bookFinishDateInput: book.finishDate || '',
      bookIsCurrentlyReadingInput: book.isCurrentlyReading,
      showEditBookModal: true,
    });
  };

  private handleUpdateBook = (): void => {
    if (!this.state.editingBookId || !this.state.bookTitleInput.trim()) return;

    const updated = this.props.books.map((b) => {
      if (b.id === this.state.editingBookId) {
        return new BookItem({
          ...b,
          title: InputSanitizer.sanitizeString(this.state.bookTitleInput),
          author: InputSanitizer.sanitizeString(this.state.bookAuthorInput),
          startDate: InputSanitizer.sanitizeString(this.state.bookStartDateInput),
          finishDate: this.state.bookIsCurrentlyReadingInput ? '' : InputSanitizer.sanitizeString(this.state.bookFinishDateInput),
          isCurrentlyReading: this.state.bookIsCurrentlyReadingInput,
          updatedAt: Date.now(),
        });
      }
      return b;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateBooks(updated);
    this.setState({
      showEditBookModal: false,
      editingBookId: null,
      bookTitleInput: '',
      bookAuthorInput: '',
      bookFinishDateInput: '',
    });
  };

  private handleDeleteBook = (bookId: string, bookTitle: string): void => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${bookTitle}" and all of its quotes and notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const updated = this.props.books.filter((b) => b.id !== bookId);
            this.props.onUpdateBooks(updated);
            if (this.state.selectedBookId === bookId) {
              this.setState({ selectedBookId: null });
            }
          },
        },
      ]
    );
  };

  // ----------------- BOOK BLOCK ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleAddBookBlock = (): void => {
    if (!this.state.selectedBookId || !this.state.blockContentInput.trim()) return;
    const book = this.props.books.find((b) => b.id === this.state.selectedBookId);
    if (!book) return;

    const updatedBook = SecondBrainPKMService.addBookBlock(
      book,
      this.state.blockTypeInput,
      this.state.blockContentInput,
      this.state.blockChapterInput
    );

    const updatedBooks = this.props.books.map((b) => (b.id === updatedBook.id ? updatedBook : b));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.props.onUpdateBooks(updatedBooks);
    this.setState({
      showAddBlockModal: false,
      blockContentInput: '',
      blockChapterInput: '',
    });
  };

  private openEditBlockModal = (block: BookQuoteBlock): void => {
    this.setState({
      editingBlockId: block.id,
      blockTypeInput: block.type === 'quote' ? 'quote' : 'note',
      blockContentInput: block.content,
      blockChapterInput: block.chapterOrPage || '',
      showEditBlockModal: true,
    });
  };

  private handleUpdateBookBlock = (): void => {
    if (!this.state.selectedBookId || !this.state.editingBlockId || !this.state.blockContentInput.trim()) return;
    const book = this.props.books.find((b) => b.id === this.state.selectedBookId);
    if (!book) return;

    const updatedBlocks = book.blocks.map((blk) => {
      if (blk.id === this.state.editingBlockId) {
        return new BookQuoteBlock({
          ...blk,
          type: this.state.blockTypeInput,
          content: InputSanitizer.sanitizeString(this.state.blockContentInput),
          chapterOrPage: InputSanitizer.sanitizeString(this.state.blockChapterInput),
          updatedAt: Date.now(),
        });
      }
      return blk;
    });

    const updatedBook = new BookItem({
      ...book,
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    const updatedBooks = this.props.books.map((b) => (b.id === updatedBook.id ? updatedBook : b));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.props.onUpdateBooks(updatedBooks);
    this.setState({
      showEditBlockModal: false,
      editingBlockId: null,
      blockContentInput: '',
      blockChapterInput: '',
    });
  };

  private handleDeleteBookBlock = (blockId: string): void => {
    if (!this.state.selectedBookId) return;
    const book = this.props.books.find((b) => b.id === this.state.selectedBookId);
    if (!book) return;

    const updatedBlocks = book.blocks.filter((b) => b.id !== blockId);
    const updatedBook = new BookItem({
      ...book,
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    const updatedBooks = this.props.books.map((b) => (b.id === updatedBook.id ? updatedBook : b));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.props.onUpdateBooks(updatedBooks);
  };

  // ----------------- KNOWLEDGE ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleCreateKnowledge = (): void => {
    if (!this.state.knowledgeTopicInput.trim()) {
      Alert.alert('Required', 'Please enter a topic.');
      return;
    }

    const newItem = SecondBrainPKMService.createNewKnowledgeItem(
      this.state.knowledgeTopicInput,
      this.state.knowledgeDescInput
    );

    const updated = [newItem, ...this.props.knowledgeItems];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateKnowledge(updated);
    this.setState({
      showAddKnowledgeModal: false,
      knowledgeTopicInput: '',
      knowledgeDescInput: '',
    });
  };

  private openEditKnowledgeModal = (item: KnowledgeItem): void => {
    this.setState({
      editingKnowledgeId: item.id,
      knowledgeTopicInput: item.topic,
      knowledgeDescInput: item.description,
      showEditKnowledgeModal: true,
    });
  };

  private handleUpdateKnowledge = (): void => {
    if (!this.state.editingKnowledgeId || !this.state.knowledgeTopicInput.trim()) return;

    const updated = this.props.knowledgeItems.map((k) => {
      if (k.id === this.state.editingKnowledgeId) {
        return new KnowledgeItem({
          ...k,
          topic: InputSanitizer.sanitizeString(this.state.knowledgeTopicInput),
          description: InputSanitizer.sanitizeString(this.state.knowledgeDescInput),
          updatedAt: Date.now(),
        });
      }
      return k;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateKnowledge(updated);
    this.setState({
      showEditKnowledgeModal: false,
      editingKnowledgeId: null,
      knowledgeTopicInput: '',
      knowledgeDescInput: '',
    });
  };

  private handleDeleteKnowledge = (id: string, topic: string): void => {
    Alert.alert(
      'Delete Knowledge',
      `Are you sure you want to delete "${topic}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const updated = this.props.knowledgeItems.filter((k) => k.id !== id);
            this.props.onUpdateKnowledge(updated);
          },
        },
      ]
    );
  };

  // ----------------- LINK ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleCreateLink = (): void => {
    if (!this.state.linkTitleInput.trim() || !this.state.linkUrlInput.trim()) {
      Alert.alert('Required', 'Please provide both title and URL.');
      return;
    }

    const safeUrl = InputSanitizer.sanitizeSafeUrl(this.state.linkUrlInput);
    if (!safeUrl) {
      Alert.alert('Invalid URL', 'Please enter a valid http:// or https:// URL.');
      return;
    }

    const newItem = SecondBrainPKMService.createNewReferenceLink(
      this.state.linkTitleInput,
      this.state.linkDescInput,
      safeUrl
    );

    const updated = [newItem, ...this.props.referenceLinks];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateLinks(updated);
    this.setState({
      showAddLinkModal: false,
      linkTitleInput: '',
      linkDescInput: '',
      linkUrlInput: '',
    });
  };

  private openEditLinkModal = (link: ReferenceLinkItem): void => {
    this.setState({
      editingLinkId: link.id,
      linkTitleInput: link.title,
      linkDescInput: link.description,
      linkUrlInput: link.url,
      showEditLinkModal: true,
    });
  };

  private handleUpdateLink = (): void => {
    if (!this.state.editingLinkId || !this.state.linkTitleInput.trim() || !this.state.linkUrlInput.trim()) return;

    const safeUrl = InputSanitizer.sanitizeSafeUrl(this.state.linkUrlInput);
    if (!safeUrl) {
      Alert.alert('Invalid URL', 'Please enter a valid http:// or https:// URL.');
      return;
    }

    const updated = this.props.referenceLinks.map((l) => {
      if (l.id === this.state.editingLinkId) {
        return new ReferenceLinkItem({
          ...l,
          title: InputSanitizer.sanitizeString(this.state.linkTitleInput),
          description: InputSanitizer.sanitizeString(this.state.linkDescInput),
          url: safeUrl,
          updatedAt: Date.now(),
        });
      }
      return l;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateLinks(updated);
    this.setState({
      showEditLinkModal: false,
      editingLinkId: null,
      linkTitleInput: '',
      linkDescInput: '',
      linkUrlInput: '',
    });
  };

  private handleDeleteLink = (id: string, title: string): void => {
    Alert.alert(
      'Delete Reference Link',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const updated = this.props.referenceLinks.filter((l) => l.id !== id);
            this.props.onUpdateLinks(updated);
          },
        },
      ]
    );
  };

  private openSafeUrl = async (url: string): Promise<void> => {
    try {
      const safe = InputSanitizer.sanitizeSafeUrl(url);
      if (safe && (await Linking.canOpenURL(safe))) {
        await Linking.openURL(safe);
      } else {
        Alert.alert('Invalid URL', 'Only valid http and https links can be opened.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open link.');
    }
  };

  // ----------------- DAILY TASK ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleCreateDailyTask = (): void => {
    if (!this.state.dailyTaskTitleInput.trim()) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }

    const newTask = SecondBrainPKMService.createRecurringTask(
      this.state.dailyTaskTitleInput,
      this.state.dailyTaskDaysInput,
      this.state.dailyTaskNoteInput
    );

    const updated = [...this.props.dailyRecurringTasks, newTask];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateDailyTasks(updated);
    this.setState({
      showAddDailyTaskModal: false,
      dailyTaskTitleInput: '',
      dailyTaskNoteInput: '',
      dailyTaskDaysInput: [1, 2, 3, 4, 5],
    });
  };

  private openEditDailyTaskModal = (task: DailyRecurringTask): void => {
    this.setState({
      editingDailyTaskId: task.id,
      dailyTaskTitleInput: task.title,
      dailyTaskNoteInput: task.note || '',
      dailyTaskDaysInput: [...task.daysOfWeek],
      showEditDailyTaskModal: true,
    });
  };

  private handleUpdateDailyTask = (): void => {
    if (!this.state.editingDailyTaskId || !this.state.dailyTaskTitleInput.trim()) return;

    const updated = this.props.dailyRecurringTasks.map((t) => {
      if (t.id === this.state.editingDailyTaskId) {
        return new DailyRecurringTask({
          ...t,
          title: InputSanitizer.sanitizeString(this.state.dailyTaskTitleInput),
          note: InputSanitizer.sanitizeString(this.state.dailyTaskNoteInput),
          daysOfWeek: this.state.dailyTaskDaysInput.length > 0 ? this.state.dailyTaskDaysInput : [0, 1, 2, 3, 4, 5, 6],
        });
      }
      return t;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateDailyTasks(updated);
    this.setState({
      showEditDailyTaskModal: false,
      editingDailyTaskId: null,
      dailyTaskTitleInput: '',
      dailyTaskNoteInput: '',
    });
  };

  private handleDeleteDailyTask = (taskId: string, title: string): void => {
    Alert.alert(
      'Delete Scheduled Routine',
      `Delete "${title}"? It will be removed from your recurring schedule.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const updated = this.props.dailyRecurringTasks.filter((t) => t.id !== taskId);
            this.props.onUpdateDailyTasks(updated);
          },
        },
      ]
    );
  };

  private toggleTaskDaySelection = (dayIndex: number): void => {
    const current = [...this.state.dailyTaskDaysInput];
    const exists = current.indexOf(dayIndex);
    if (exists > -1) {
      current.splice(exists, 1);
    } else {
      current.push(dayIndex);
    }
    this.setState({ dailyTaskDaysInput: current.sort() });
  };

  private navigateDate = (offsetDays: number): void => {
    const nextKey = DailyDiaryService.getAdjacentDateKey(this.state.selectedDateKey, offsetDays);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ selectedDateKey: nextKey });
  };

  // ----------------- PROJECT ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleCreateProject = (): void => {
    if (!this.state.projectNameInput.trim()) {
      Alert.alert('Required', 'Please enter a project name.');
      return;
    }

    const newProject = SecondBrainPKMService.createNewProject(
      this.state.projectNameInput,
      this.state.projectDescInput
    );

    const updated = [newProject, ...this.props.projects];
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateProjects(updated);
    this.setState({
      showAddProjectModal: false,
      projectNameInput: '',
      projectDescInput: '',
      selectedProjectId: newProject.id,
    });
  };

  private openEditProjectModal = (proj: ProjectItem): void => {
    this.setState({
      editingProjectId: proj.id,
      projectNameInput: proj.name,
      projectDescInput: proj.description,
      projectStatusInput: proj.status,
      showEditProjectModal: true,
    });
  };

  private handleUpdateProject = (): void => {
    if (!this.state.editingProjectId || !this.state.projectNameInput.trim()) return;

    const updated = this.props.projects.map((p) => {
      if (p.id === this.state.editingProjectId) {
        return new ProjectItem({
          ...p,
          name: InputSanitizer.sanitizeString(this.state.projectNameInput),
          description: InputSanitizer.sanitizeString(this.state.projectDescInput),
          status: this.state.projectStatusInput,
          updatedAt: Date.now(),
        });
      }
      return p;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.onUpdateProjects(updated);
    this.setState({
      showEditProjectModal: false,
      editingProjectId: null,
      projectNameInput: '',
      projectDescInput: '',
    });
  };

  private handleDeleteProject = (projId: string, name: string): void => {
    Alert.alert(
      'Delete Project',
      `Delete "${name}" and all its brainstorm cards? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            const updated = this.props.projects.filter((p) => p.id !== projId);
            this.props.onUpdateProjects(updated);
            if (this.state.selectedProjectId === projId) {
              this.setState({ selectedProjectId: null });
            }
          },
        },
      ]
    );
  };

  // ----------------- CARD ACTIONS (CREATE, EDIT, DELETE) -----------------
  private handleAddCard = (): void => {
    if (!this.state.selectedProjectId || !this.state.cardTitleInput.trim()) return;
    const project = this.props.projects.find((p) => p.id === this.state.selectedProjectId);
    if (!project) return;

    const updatedProject = SecondBrainPKMService.addBrainstormCard(
      project,
      this.state.cardTitleInput,
      this.state.cardContentInput,
      this.state.cardColorTagInput
    );

    const updated = this.props.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.props.onUpdateProjects(updated);
    this.setState({
      showAddCardModal: false,
      cardTitleInput: '',
      cardContentInput: '',
    });
  };

  private openEditCardModal = (card: BrainstormCard): void => {
    this.setState({
      editingCardId: card.id,
      cardTitleInput: card.title,
      cardContentInput: card.content,
      cardColorTagInput: card.colorTag || '#E2A154',
      showEditCardModal: true,
    });
  };

  private handleUpdateCard = (): void => {
    if (!this.state.selectedProjectId || !this.state.editingCardId || !this.state.cardTitleInput.trim()) return;
    const project = this.props.projects.find((p) => p.id === this.state.selectedProjectId);
    if (!project) return;

    const updatedCards = project.cards.map((c) => {
      if (c.id === this.state.editingCardId) {
        return new BrainstormCard({
          ...c,
          title: InputSanitizer.sanitizeString(this.state.cardTitleInput),
          content: InputSanitizer.sanitizeString(this.state.cardContentInput),
          colorTag: InputSanitizer.sanitizeColorHex(this.state.cardColorTagInput, '#E2A154'),
          updatedAt: Date.now(),
        });
      }
      return c;
    });

    const updatedProject = new ProjectItem({
      ...project,
      cards: updatedCards,
      updatedAt: Date.now(),
    });

    const updated = this.props.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.props.onUpdateProjects(updated);
    this.setState({
      showEditCardModal: false,
      editingCardId: null,
      cardTitleInput: '',
      cardContentInput: '',
    });
  };

  private handleDeleteCard = (cardId: string): void => {
    if (!this.state.selectedProjectId) return;
    const project = this.props.projects.find((p) => p.id === this.state.selectedProjectId);
    if (!project) return;

    const updatedCards = project.cards.filter((c) => c.id !== cardId);
    const updatedProject = new ProjectItem({
      ...project,
      cards: updatedCards,
      updatedAt: Date.now(),
    });

    const updated = this.props.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.props.onUpdateProjects(updated);
  };

  public override render() {
    const { palette, metrics } = this.props;
    const { activeSubTab, searchQuery, selectedBookId, selectedProjectId, selectedDateKey, showRoutineManagerList } = this.state;
    const query = searchQuery.trim().toLowerCase();

    // 1. Filtered Books
    const currentBook = this.props.books.find((b) => b.id === selectedBookId);
    const filteredBooks = this.props.books.filter((b) => {
      if (!query) return true;
      const matchTitle = b.title.toLowerCase().includes(query);
      const matchAuthor = b.author.toLowerCase().includes(query);
      const matchBlocks = b.blocks.some((blk) => blk.content.toLowerCase().includes(query));
      return matchTitle || matchAuthor || matchBlocks;
    });

    // 2. Filtered Knowledge
    const filteredKnowledge = this.props.knowledgeItems.filter((k) => {
      if (!query) return true;
      return (
        k.topic.toLowerCase().includes(query) ||
        k.description.toLowerCase().includes(query) ||
        k.blocks.some((b) => b.content.toLowerCase().includes(query))
      );
    });

    // 3. Filtered Links
    const filteredLinks = this.props.referenceLinks.filter((l) => {
      if (!query) return true;
      return (
        l.title.toLowerCase().includes(query) ||
        l.description.toLowerCase().includes(query) ||
        l.url.toLowerCase().includes(query)
      );
    });

    // 4. Daily Tasks & Statistics for Selected Date
    const scheduledDailyTasks = SecondBrainPKMService.getTasksForDate(
      this.props.dailyRecurringTasks,
      selectedDateKey
    );
    const dayCompletions = this.props.dailyTaskCompletions[selectedDateKey] || {};
    const taskStats: DailyTaskStatistics = SecondBrainPKMService.calculateDailyTaskStatistics(
      this.props.dailyRecurringTasks,
      this.props.dailyTaskCompletions,
      selectedDateKey
    );

    // 5. Projects
    const currentProject = this.props.projects.find((p) => p.id === selectedProjectId);
    const filteredProjects = this.props.projects.filter((p) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.cards.some((c) => c.title.toLowerCase().includes(query) || c.content.toLowerCase().includes(query))
      );
    });

    return (
      <View style={[this.styles.container, { maxWidth: metrics.maxContainerWidth, alignSelf: 'center', width: '100%', paddingHorizontal: metrics.horizontalPadding }]}>
        {/* Module Sub-Tabs Pill Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={this.styles.subTabRow}
          style={{ marginBottom: 12, flexGrow: 0 }}
        >
          {(
            [
              { id: 'books', label: `📚 Books (${filteredBooks.length})` },
              { id: 'knowledge', label: `💡 Knowledge (${filteredKnowledge.length})` },
              { id: 'links', label: `🔗 Links (${filteredLinks.length})` },
              { id: 'daily_tasks', label: `📅 Routines (${this.props.dailyRecurringTasks.length})` },
              { id: 'projects', label: `🚀 Projects (${filteredProjects.length})` },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                this.setState({ activeSubTab: tab.id, selectedBookId: null, selectedProjectId: null });
              }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: activeSubTab === tab.id }}
              style={[
                this.styles.subTabPill,
                {
                  backgroundColor: activeSubTab === tab.id ? palette.accent : palette.glassElevated,
                  borderColor: activeSubTab === tab.id ? palette.accent : palette.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  this.styles.subTabPillText,
                  { color: activeSubTab === tab.id ? palette.accentContrast : palette.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Local Search Bar */}
        <TextInput
          style={[
            this.styles.searchInput,
            {
              backgroundColor: palette.cardBackground,
              borderColor: palette.cardBorder,
              color: palette.textPrimary,
            },
          ]}
          value={searchQuery}
          onChangeText={(txt) => this.setState({ searchQuery: txt })}
          placeholder={`Search ${activeSubTab.replace('_', ' ')} with highlighted matches...`}
          placeholderTextColor={palette.textMuted}
        />

        {/* -------------------- TAB 1: BOOKS -------------------- */}
        {activeSubTab === 'books' && (
          <View style={this.styles.tabContentArea}>
            {currentBook ? (
              // Book Detail View (with quotes and notes blocks + Edit/Delete actions)
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
                <View style={this.styles.detailTopBar}>
                  <TouchableOpacity
                    onPress={() => this.setState({ selectedBookId: null })}
                    style={this.styles.backBtn}
                  >
                    <Text style={[this.styles.backBtnText, { color: palette.accent }]}>← All Books</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => this.openEditBookModal(currentBook)}
                      style={[this.styles.actionPillOutline, { borderColor: palette.glassBorder, backgroundColor: palette.glassElevated }]}
                    >
                      <Text style={[this.styles.actionPillOutlineText, { color: palette.textPrimary }]}>✎ Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => this.handleDeleteBook(currentBook.id, currentBook.title)}
                      style={[this.styles.actionPillOutline, { borderColor: palette.danger, backgroundColor: palette.glassElevated }]}
                    >
                      <Text style={[this.styles.actionPillOutlineText, { color: palette.danger }]}>🗑 Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => this.setState({ showAddBlockModal: true })}
                      style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                    >
                      <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ Quote/Note</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[this.styles.bookHeroCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                  <Text style={[this.styles.bookTitleLarge, { color: palette.textPrimary }]}>
                    {this.renderHighlightedText(currentBook.title, query, palette.textPrimary, palette.accent)}
                  </Text>
                  <Text style={[this.styles.bookAuthorLarge, { color: palette.accent }]}>
                    by {this.renderHighlightedText(currentBook.author, query, palette.accent, palette.textSecondary)}
                  </Text>
                  <View style={this.styles.bookDatePill}>
                    <Text style={[this.styles.bookDateText, { color: palette.textSecondary }]}>
                      {currentBook.isCurrentlyReading
                        ? `📖 Currently Reading (Started ${currentBook.startDate})`
                        : `✅ Read from ${currentBook.startDate} to ${currentBook.finishDate || 'Finished'}`}
                    </Text>
                  </View>
                </View>

                <Text style={[this.styles.sectionSubhead, { color: palette.accent }]}>
                  QUOTES & IMPORTANT BLOCKS ({currentBook.blocks.length})
                </Text>

                {currentBook.blocks.map((block) => (
                  <View
                    key={block.id}
                    style={[
                      this.styles.bookBlockCard,
                      {
                        backgroundColor: block.type === 'quote' ? palette.calloutBg : palette.cardBackground,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    <View style={this.styles.blockHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[this.styles.blockBadge, { color: palette.accent }]}>
                          {block.type === 'quote' ? '❝ QUOTE' : '📝 NOTE'}
                        </Text>
                        {Boolean(block.chapterOrPage) && (
                          <Text style={[this.styles.chapterTag, { color: palette.textMuted }]}>
                            {block.chapterOrPage}
                          </Text>
                        )}
                      </View>

                      {/* Block Edit & Delete buttons */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => this.openEditBlockModal(block)} style={this.styles.microIconBtn}>
                          <Text style={[this.styles.microIconText, { color: palette.textSecondary }]}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => this.handleDeleteBookBlock(block.id)} style={this.styles.microIconBtn}>
                          <Text style={[this.styles.microIconText, { color: palette.danger }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[this.styles.blockBodyText, { color: palette.textPrimary }]}>
                      {this.renderHighlightedText(block.content, query, palette.textPrimary, palette.accent)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              // Books List View
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
                <View style={this.styles.listHeaderRow}>
                  <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                    Reading Library ({filteredBooks.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddBookModal: true })}
                    style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ New Book</Text>
                  </TouchableOpacity>
                </View>

                {filteredBooks.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    onPress={() => this.setState({ selectedBookId: book.id })}
                    style={[this.styles.cardItem, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
                  >
                    <View style={this.styles.cardTopRow}>
                      <Text style={[this.styles.cardTitle, { color: palette.textPrimary }]}>
                        {this.renderHighlightedText(book.title, query, palette.textPrimary, palette.accent)}
                      </Text>
                      <View
                        style={[
                          this.styles.statusPill,
                          { backgroundColor: book.isCurrentlyReading ? palette.calloutBg : palette.glassElevated },
                        ]}
                      >
                        <Text style={[this.styles.statusPillText, { color: book.isCurrentlyReading ? palette.accent : palette.textMuted }]}>
                          {book.isCurrentlyReading ? 'Reading' : 'Finished'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[this.styles.cardSubtitle, { color: palette.accent }]}>
                      by {this.renderHighlightedText(book.author, query, palette.accent, palette.textSecondary)}
                    </Text>
                    <View style={this.styles.cardBottomRow}>
                      <Text style={[this.styles.cardMeta, { color: palette.textSecondary }]}>
                        {book.blocks.length} quotes & notes
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            this.openEditBookModal(book);
                          }}
                          style={this.styles.cardActionIconBtn}
                        >
                          <Text style={[this.styles.cardActionIconText, { color: palette.textSecondary }]}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            this.handleDeleteBook(book.id, book.title);
                          }}
                          style={this.styles.cardActionIconBtn}
                        >
                          <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* -------------------- TAB 2: KNOWLEDGE HUB -------------------- */}
        {activeSubTab === 'knowledge' && (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
            <View style={this.styles.listHeaderRow}>
              <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                Important Knowledge Vault ({filteredKnowledge.length})
              </Text>
              <TouchableOpacity
                onPress={() => this.setState({ showAddKnowledgeModal: true })}
                style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
              >
                <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ Add Knowledge</Text>
              </TouchableOpacity>
            </View>

            {filteredKnowledge.map((item) => (
              <View
                key={item.id}
                style={[this.styles.cardItem, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
              >
                <View style={this.styles.cardTopRow}>
                  <Text style={[this.styles.cardTitle, { color: palette.textPrimary }]}>
                    💡 {this.renderHighlightedText(item.topic, query, palette.textPrimary, palette.accent)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => this.openEditKnowledgeModal(item)} style={this.styles.cardActionIconBtn}>
                      <Text style={[this.styles.cardActionIconText, { color: palette.textSecondary }]}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => this.handleDeleteKnowledge(item.id, item.topic)} style={this.styles.cardActionIconBtn}>
                      <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[this.styles.cardDescription, { color: palette.textSecondary }]}>
                  {this.renderHighlightedText(item.description, query, palette.textSecondary, palette.accent)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* -------------------- TAB 3: IMPORTANT LINKS -------------------- */}
        {activeSubTab === 'links' && (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
            <View style={this.styles.listHeaderRow}>
              <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                Curated Links & References ({filteredLinks.length})
              </Text>
              <TouchableOpacity
                onPress={() => this.setState({ showAddLinkModal: true })}
                style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
              >
                <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ Add Link</Text>
              </TouchableOpacity>
            </View>

            {filteredLinks.map((link) => (
              <View
                key={link.id}
                style={[this.styles.cardItem, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
              >
                <View style={this.styles.cardTopRow}>
                  <Text style={[this.styles.cardTitle, { color: palette.textPrimary }]}>
                    🔗 {this.renderHighlightedText(link.title, query, palette.textPrimary, palette.accent)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => this.openEditLinkModal(link)} style={this.styles.cardActionIconBtn}>
                      <Text style={[this.styles.cardActionIconText, { color: palette.textSecondary }]}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => this.handleDeleteLink(link.id, link.title)} style={this.styles.cardActionIconBtn}>
                      <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {Boolean(link.description) && (
                  <Text style={[this.styles.cardDescription, { color: palette.textSecondary }]}>
                    {this.renderHighlightedText(link.description, query, palette.textSecondary, palette.accent)}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => this.openSafeUrl(link.url)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="link"
                  accessibilityLabel={`Open link: ${link.title}`}
                  style={this.styles.urlLinkRow}
                >
                  <View style={[this.styles.domainChip, { backgroundColor: palette.calloutBg, borderColor: palette.accent + '33' }]}>
                    <Text style={[this.styles.domainChipText, { color: palette.accent }]}>
                      🌐 {(() => {
                        try {
                          return link.url.replace(/^https?:\/\//i, '').split('/')[0];
                        } catch {
                          return 'web';
                        }
                      })()}
                    </Text>
                  </View>
                  <Text style={[this.styles.urlLinkText, { color: palette.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {link.url}
                  </Text>
                  <Text style={{ color: palette.accent, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>↗</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* -------------------- TAB 4: DAILY TASK TRACKER -------------------- */}
        {activeSubTab === 'daily_tasks' && (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
            {/* Date Bar with Previous / Next Day Navigation */}
            <View style={[this.styles.dateNavCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
              <TouchableOpacity onPress={() => this.navigateDate(-1)} style={this.styles.dateNavArrow}>
                <Text style={[this.styles.dateNavArrowText, { color: palette.accent }]}>◀ Prev</Text>
              </TouchableOpacity>
              <View style={this.styles.dateNavCenter}>
                <Text style={[this.styles.dateNavTitle, { color: palette.textPrimary }]}>
                  {DailyDiaryService.formatDateKeyToReadable(selectedDateKey)}
                </Text>
                {selectedDateKey === DailyDiaryService.getTodayDateKey() && (
                  <Text style={[this.styles.todayBadge, { color: palette.accent }]}>Today</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => this.navigateDate(1)} style={this.styles.dateNavArrow}>
                <Text style={[this.styles.dateNavArrowText, { color: palette.accent }]}>Next ▶</Text>
              </TouchableOpacity>
            </View>

            {/* Statistics Banner */}
            <View style={[this.styles.statsRow, { backgroundColor: palette.surfaceElevated, borderColor: palette.cardBorder }]}>
              <View style={this.styles.statBox}>
                <Text style={[this.styles.statValue, { color: palette.accent }]}>
                  {taskStats.completionPercentage}%
                </Text>
                <Text style={[this.styles.statLabel, { color: palette.textMuted }]}>Selected Day</Text>
              </View>
              <View style={this.styles.statBox}>
                <Text style={[this.styles.statValue, { color: palette.success }]}>
                  {taskStats.completedToday}/{taskStats.totalScheduledToday}
                </Text>
                <Text style={[this.styles.statLabel, { color: palette.textMuted }]}>Done</Text>
              </View>
              <View style={this.styles.statBox}>
                <Text style={[this.styles.statValue, { color: palette.textPrimary }]}>
                  {taskStats.sevenDayAveragePercentage}%
                </Text>
                <Text style={[this.styles.statLabel, { color: palette.textMuted }]}>7-Day Avg</Text>
              </View>
              <View style={this.styles.statBox}>
                <Text style={[this.styles.statValue, { color: palette.warning }]}>
                  🔥 {taskStats.consistencyStreakDays}d
                </Text>
                <Text style={[this.styles.statLabel, { color: palette.textMuted }]}>Streak</Text>
              </View>
            </View>

            <View style={this.styles.listHeaderRow}>
              <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                Tasks for this day ({scheduledDailyTasks.length})
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => this.setState({ showRoutineManagerList: !showRoutineManagerList })}
                  style={[this.styles.actionPillOutline, { borderColor: palette.glassBorder, backgroundColor: palette.glassElevated }]}
                >
                  <Text style={[this.styles.actionPillOutlineText, { color: palette.textPrimary }]}>
                    {showRoutineManagerList ? 'Done Managing' : '⚙️ Manage Routines'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => this.setState({ showAddDailyTaskModal: true })}
                  style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                >
                  <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ New Task</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Routine Manager Drawer (Edit & Delete All Routines) */}
            {showRoutineManagerList && (
              <View style={[this.styles.routineManagerDrawer, { backgroundColor: palette.surfaceElevated, borderColor: palette.cardBorder }]}>
                <Text style={[this.styles.sectionSubhead, { color: palette.accent }]}>ALL SCHEDULED ROUTINES ({this.props.dailyRecurringTasks.length})</Text>
                {this.props.dailyRecurringTasks.map((t) => (
                  <View key={t.id} style={this.styles.routineManageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[this.styles.routineManageTitle, { color: palette.textPrimary }]}>{t.title}</Text>
                      <Text style={[this.styles.taskDaysPill, { color: palette.accent }]}>
                        {t.daysOfWeek.map((d) => this.DAY_NAMES[d]).join(', ')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => this.openEditDailyTaskModal(t)} style={this.styles.cardActionIconBtn}>
                        <Text style={[this.styles.cardActionIconText, { color: palette.textSecondary }]}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => this.handleDeleteDailyTask(t.id, t.title)} style={this.styles.cardActionIconBtn}>
                        <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Daily Tasks for Selected Date */}
            {scheduledDailyTasks.length === 0 ? (
              <View style={this.styles.emptyCard}>
                <Text style={[this.styles.emptyCardText, { color: palette.textMuted }]}>
                  No tasks scheduled for this day of week. Tap "+ New Task" to schedule routines like Gym on Mon, Tue, Fri.
                </Text>
              </View>
            ) : (
              scheduledDailyTasks.map((task) => {
                const isChecked = Boolean(dayCompletions[task.id]);
                return (
                  <View
                    key={task.id}
                    style={[this.styles.taskItemCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
                  >
                    <TouchableOpacity
                      onPress={() => this.props.onToggleDailyTaskCompletion(selectedDateKey, task.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      accessibilityLabel={`Toggle habit: ${task.title}`}
                      style={[
                        this.styles.taskCheck,
                        {
                          borderColor: isChecked ? palette.accent : palette.border,
                          backgroundColor: isChecked ? palette.accent : 'transparent',
                        },
                      ]}
                    >
                      {isChecked && <Text style={[this.styles.taskCheckMark, { color: palette.accentContrast }]}>✓</Text>}
                    </TouchableOpacity>
                    <View style={this.styles.taskBody}>
                      <Text
                        style={[
                          this.styles.taskTitleText,
                          {
                            color: isChecked ? palette.textMuted : palette.textPrimary,
                            textDecorationLine: isChecked ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {task.title}
                      </Text>
                      {Boolean(task.note) && (
                        <Text style={[this.styles.taskNoteText, { color: palette.textSecondary }]}>
                          {task.note}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' }}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, dIdx) => {
                          const isScheduled = task.daysOfWeek.includes(dIdx);
                          return (
                            <View
                              key={dIdx}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: isScheduled ? palette.calloutBg : 'transparent',
                                borderColor: isScheduled ? palette.accent : palette.border,
                                borderWidth: 1,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: isScheduled ? '700' : '400',
                                  color: isScheduled ? palette.accent : palette.textMuted,
                                }}
                              >
                                {dayChar}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Quick Edit button */}
                    <TouchableOpacity
                      onPress={() => this.openEditDailyTaskModal(task)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit routine ${task.title}`}
                      style={this.styles.microIconBtn}
                    >
                      <Text style={[this.styles.microIconText, { color: palette.textSecondary }]}>✎</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* -------------------- TAB 5: PROJECTS -------------------- */}
        {activeSubTab === 'projects' && (
          <View style={this.styles.tabContentArea}>
            {currentProject ? (
              // Project Detail View with Brainstorm Cards + Edit/Delete Project
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
                <View style={this.styles.detailTopBar}>
                  <TouchableOpacity
                    onPress={() => this.setState({ selectedProjectId: null })}
                    style={this.styles.backBtn}
                  >
                    <Text style={[this.styles.backBtnText, { color: palette.accent }]}>← All Projects</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => this.openEditProjectModal(currentProject)}
                      style={[this.styles.actionPillOutline, { borderColor: palette.glassBorder, backgroundColor: palette.glassElevated }]}
                    >
                      <Text style={[this.styles.actionPillOutlineText, { color: palette.textPrimary }]}>✎ Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => this.handleDeleteProject(currentProject.id, currentProject.name)}
                      style={[this.styles.actionPillOutline, { borderColor: palette.danger, backgroundColor: palette.glassElevated }]}
                    >
                      <Text style={[this.styles.actionPillOutlineText, { color: palette.danger }]}>🗑 Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => this.setState({ showAddCardModal: true })}
                      style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                    >
                      <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ Idea Card</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[this.styles.projectHeroCard, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                  <Text style={[this.styles.projectTitleLarge, { color: palette.textPrimary }]}>
                    🚀 {currentProject.name}
                  </Text>
                  {Boolean(currentProject.description) && (
                    <Text style={[this.styles.projectDescLarge, { color: palette.textSecondary }]}>
                      {currentProject.description}
                    </Text>
                  )}
                  <View style={this.styles.projectStatusBadge}>
                    <Text style={[this.styles.projectStatusBadgeText, { color: palette.accent }]}>
                      STATUS: {currentProject.status.toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <Text style={[this.styles.sectionSubhead, { color: palette.accent }]}>
                  BRAINSTORMED CARDS ({currentProject.cards.length})
                </Text>

                <View style={this.styles.cardsGrid}>
                  {currentProject.cards.map((card) => (
                    <View
                      key={card.id}
                      style={[
                        this.styles.brainstormCard,
                        {
                          backgroundColor: palette.cardBackground,
                          borderColor: card.colorTag || palette.cardBorder,
                        },
                      ]}
                    >
                      <View style={this.styles.cardHeaderRow}>
                        <View style={[this.styles.colorBadge, { backgroundColor: card.colorTag || palette.accent }]} />
                        <Text style={[this.styles.brainstormTitle, { color: palette.textPrimary }]}>
                          {this.renderHighlightedText(card.title, query, palette.textPrimary, palette.accent)}
                        </Text>
                        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={() => this.openEditCardModal(card)} style={this.styles.microIconBtn}>
                            <Text style={[this.styles.microIconText, { color: palette.textSecondary }]}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => this.handleDeleteCard(card.id)} style={this.styles.microIconBtn}>
                            <Text style={[this.styles.microIconText, { color: palette.danger }]}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[this.styles.brainstormContent, { color: palette.textSecondary }]}>
                        {this.renderHighlightedText(card.content, query, palette.textSecondary, palette.accent)}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              // Projects List View
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: (this.props.isKeyboardVisible ? (this.props.keyboardHeight || 300) + 120 : 120) + metrics.safeBottomInset }}>
                <View style={this.styles.listHeaderRow}>
                  <Text style={[this.styles.listHeading, { color: palette.textPrimary }]}>
                    Active Projects ({filteredProjects.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddProjectModal: true })}
                    style={[this.styles.actionPill, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.actionPillText, { color: palette.accentContrast }]}>+ New Project</Text>
                  </TouchableOpacity>
                </View>

                {filteredProjects.map((proj) => (
                  <TouchableOpacity
                    key={proj.id}
                    onPress={() => this.setState({ selectedProjectId: proj.id })}
                    style={[this.styles.cardItem, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}
                  >
                    <View style={this.styles.cardTopRow}>
                      <Text style={[this.styles.cardTitle, { color: palette.textPrimary }]}>
                        🚀 {this.renderHighlightedText(proj.name, query, palette.textPrimary, palette.accent)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            this.openEditProjectModal(proj);
                          }}
                          style={this.styles.cardActionIconBtn}
                        >
                          <Text style={[this.styles.cardActionIconText, { color: palette.textSecondary }]}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            this.handleDeleteProject(proj.id, proj.name);
                          }}
                          style={this.styles.cardActionIconBtn}
                        >
                          <Text style={[this.styles.cardActionIconText, { color: palette.danger }]}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {Boolean(proj.description) && (
                      <Text style={[this.styles.cardDescription, { color: palette.textSecondary }]}>
                        {this.renderHighlightedText(proj.description, query, palette.textSecondary, palette.accent)}
                      </Text>
                    )}
                    <Text style={[this.styles.cardMeta, { color: palette.accent }]}>
                      {proj.cards.length} brainstorm cards
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* -------------------- MODAL: CREATE / EDIT BOOK -------------------- */}
        <Modal visible={this.state.showAddBookModal || this.state.showEditBookModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditBookModal ? 'Edit Book' : 'Add New Book'}
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.bookTitleInput}
                  onChangeText={(txt) => this.setState({ bookTitleInput: txt })}
                  placeholder="Book Title (e.g. Atomic Habits)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.bookAuthorInput}
                  onChangeText={(txt) => this.setState({ bookAuthorInput: txt })}
                  placeholder="Author (e.g. James Clear)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.bookStartDateInput}
                  onChangeText={(txt) => this.setState({ bookStartDateInput: txt })}
                  placeholder="Start Date (YYYY-MM-DD)..."
                  placeholderTextColor={palette.textMuted}
                />

                <TouchableOpacity
                  onPress={() => this.setState({ bookIsCurrentlyReadingInput: !this.state.bookIsCurrentlyReadingInput })}
                  style={this.styles.toggleRow}
                >
                  <View style={[this.styles.checkboxSmall, { borderColor: palette.accent, backgroundColor: this.state.bookIsCurrentlyReadingInput ? palette.accent : 'transparent' }]}>
                    {this.state.bookIsCurrentlyReadingInput && <Text style={[this.styles.checkmarkSmall, { color: palette.accentContrast }]}>✓</Text>}
                  </View>
                  <Text style={[this.styles.toggleLabel, { color: palette.textPrimary }]}>Currently Reading</Text>
                </TouchableOpacity>

                {!this.state.bookIsCurrentlyReadingInput && (
                  <TextInput
                    style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                    value={this.state.bookFinishDateInput}
                    onChangeText={(txt) => this.setState({ bookFinishDateInput: txt })}
                    placeholder="Finish Date (YYYY-MM-DD)..."
                    placeholderTextColor={palette.textMuted}
                  />
                )}

                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddBookModal: false, showEditBookModal: false, editingBookId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditBookModal ? this.handleUpdateBook : this.handleCreateBook}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditBookModal ? 'Save Changes' : 'Create Book'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT BOOK BLOCK -------------------- */}
        <Modal visible={this.state.showAddBlockModal || this.state.showEditBlockModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditBlockModal ? 'Edit Quote or Note' : 'Add Quote or Note'}
                </Text>
                <View style={this.styles.typeSelectorRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ blockTypeInput: 'quote' })}
                    style={[this.styles.typePill, { backgroundColor: this.state.blockTypeInput === 'quote' ? palette.accent : palette.glassElevated }]}
                  >
                    <Text style={{ color: this.state.blockTypeInput === 'quote' ? palette.accentContrast : palette.textPrimary, fontWeight: '700' }}>❝ Quote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => this.setState({ blockTypeInput: 'note' })}
                    style={[this.styles.typePill, { backgroundColor: this.state.blockTypeInput === 'note' ? palette.accent : palette.glassElevated }]}
                  >
                    <Text style={{ color: this.state.blockTypeInput === 'note' ? palette.accentContrast : palette.textPrimary, fontWeight: '700' }}>📝 Note</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.blockChapterInput}
                  onChangeText={(txt) => this.setState({ blockChapterInput: txt })}
                  placeholder="Chapter or Page (e.g. Chapter 3, p. 45)..."
                  placeholderTextColor={palette.textMuted}
                />

                <TextInput
                  multiline
                  numberOfLines={4}
                  style={[this.styles.modalTextArea, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.blockContentInput}
                  onChangeText={(txt) => this.setState({ blockContentInput: txt })}
                  placeholder="Enter important quote or insight..."
                  placeholderTextColor={palette.textMuted}
                />

                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddBlockModal: false, showEditBlockModal: false, editingBlockId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditBlockModal ? this.handleUpdateBookBlock : this.handleAddBookBlock}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditBlockModal ? 'Save Block' : 'Add to Book'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT KNOWLEDGE -------------------- */}
        <Modal visible={this.state.showAddKnowledgeModal || this.state.showEditKnowledgeModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditKnowledgeModal ? 'Edit Knowledge' : 'Add Future Knowledge'}
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.knowledgeTopicInput}
                  onChangeText={(txt) => this.setState({ knowledgeTopicInput: txt })}
                  placeholder="Topic (e.g. React Native Architecture)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  multiline
                  numberOfLines={4}
                  style={[this.styles.modalTextArea, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.knowledgeDescInput}
                  onChangeText={(txt) => this.setState({ knowledgeDescInput: txt })}
                  placeholder="Detailed description, takeaway, or guideline..."
                  placeholderTextColor={palette.textMuted}
                />
                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddKnowledgeModal: false, showEditKnowledgeModal: false, editingKnowledgeId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditKnowledgeModal ? this.handleUpdateKnowledge : this.handleCreateKnowledge}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditKnowledgeModal ? 'Save Changes' : 'Save Knowledge'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT LINK -------------------- */}
        <Modal visible={this.state.showAddLinkModal || this.state.showEditLinkModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditLinkModal ? 'Edit Reference Link' : 'Add Important Reference Link'}
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.linkTitleInput}
                  onChangeText={(txt) => this.setState({ linkTitleInput: txt })}
                  placeholder="Title (e.g. OWASP Mobile Top 10)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.linkUrlInput}
                  onChangeText={(txt) => this.setState({ linkUrlInput: txt })}
                  placeholder="URL (https://...)..."
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  multiline
                  numberOfLines={3}
                  style={[this.styles.modalTextArea, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.linkDescInput}
                  onChangeText={(txt) => this.setState({ linkDescInput: txt })}
                  placeholder="Description / why this link is important..."
                  placeholderTextColor={palette.textMuted}
                />
                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddLinkModal: false, showEditLinkModal: false, editingLinkId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditLinkModal ? this.handleUpdateLink : this.handleCreateLink}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditLinkModal ? 'Save Changes' : 'Save Link'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT DAILY TASK ROUTINE -------------------- */}
        <Modal visible={this.state.showAddDailyTaskModal || this.state.showEditDailyTaskModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditDailyTaskModal ? 'Edit Scheduled Routine' : 'Common Routine Scheduler'}
                </Text>
                <Text style={[this.styles.modalSubtitle, { color: palette.textSecondary }]}>
                  Configure task and select which days of the week it runs.
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.dailyTaskTitleInput}
                  onChangeText={(txt) => this.setState({ dailyTaskTitleInput: txt })}
                  placeholder="Task Title (e.g. Go to Gym, Read 20 pages)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.dailyTaskNoteInput}
                  onChangeText={(txt) => this.setState({ dailyTaskNoteInput: txt })}
                  placeholder="Optional Note or focus details..."
                  placeholderTextColor={palette.textMuted}
                />

                <Text style={[this.styles.daysSelectorLabel, { color: palette.accent }]}>ACTIVE DAYS IN WEEK:</Text>
                <View style={this.styles.daysButtonRow}>
                  {this.DAY_NAMES.map((name, idx) => {
                    const isSelected = this.state.dailyTaskDaysInput.includes(idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => this.toggleTaskDaySelection(idx)}
                        style={[
                          this.styles.dayCircle,
                          {
                            backgroundColor: isSelected ? palette.accent : palette.glassElevated,
                            borderColor: isSelected ? palette.accent : palette.glassBorder,
                          },
                        ]}
                      >
                        <Text style={[this.styles.dayCircleText, { color: isSelected ? palette.accentContrast : palette.textSecondary }]}>
                          {name[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddDailyTaskModal: false, showEditDailyTaskModal: false, editingDailyTaskId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditDailyTaskModal ? this.handleUpdateDailyTask : this.handleCreateDailyTask}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditDailyTaskModal ? 'Save Routine' : 'Schedule Task'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT PROJECT -------------------- */}
        <Modal visible={this.state.showAddProjectModal || this.state.showEditProjectModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditProjectModal ? 'Edit Project' : 'Create Project'}
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.projectNameInput}
                  onChangeText={(txt) => this.setState({ projectNameInput: txt })}
                  placeholder="Project Name (e.g. Noctis Mobile 2.0)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  multiline
                  numberOfLines={3}
                  style={[this.styles.modalTextArea, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.projectDescInput}
                  onChangeText={(txt) => this.setState({ projectDescInput: txt })}
                  placeholder="High-level project objective or scope..."
                  placeholderTextColor={palette.textMuted}
                />

                {this.state.showEditProjectModal && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[this.styles.daysSelectorLabel, { color: palette.accent }]}>STATUS:</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['active', 'completed', 'on_hold'] as const).map((st) => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => this.setState({ projectStatusInput: st })}
                          style={[
                            this.styles.typePill,
                            { backgroundColor: this.state.projectStatusInput === st ? palette.accent : palette.glassElevated },
                          ]}
                        >
                          <Text style={{ color: this.state.projectStatusInput === st ? palette.accentContrast : palette.textPrimary, fontWeight: '700' }}>
                            {st.toUpperCase().replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddProjectModal: false, showEditProjectModal: false, editingProjectId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditProjectModal ? this.handleUpdateProject : this.handleCreateProject}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditProjectModal ? 'Save Project' : 'Create Project'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* -------------------- MODAL: CREATE / EDIT BRAINSTORM CARD -------------------- */}
        <Modal visible={this.state.showAddCardModal || this.state.showEditCardModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={this.styles.modalBackdrop}
          >
            <View style={[this.styles.modalSheet, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={[this.styles.modalTitle, { color: palette.textPrimary }]}>
                  {this.state.showEditCardModal ? 'Edit Brainstorm Card' : 'Add Brainstorm Idea Card'}
                </Text>
                <TextInput
                  style={[this.styles.modalInput, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.cardTitleInput}
                  onChangeText={(txt) => this.setState({ cardTitleInput: txt })}
                  placeholder="Card Title (e.g. UI Animation Plan)..."
                  placeholderTextColor={palette.textMuted}
                />
                <TextInput
                  multiline
                  numberOfLines={4}
                  style={[this.styles.modalTextArea, { backgroundColor: palette.cardBackground, color: palette.textPrimary, borderColor: palette.cardBorder }]}
                  value={this.state.cardContentInput}
                  onChangeText={(txt) => this.setState({ cardContentInput: txt })}
                  placeholder="Brainstormed details, bullets, or notes..."
                  placeholderTextColor={palette.textMuted}
                />

                <Text style={[this.styles.daysSelectorLabel, { color: palette.accent }]}>CARD COLOR TAG:</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  {['#E2A154', '#34D399', '#38BDF8', '#F472B6', '#A78BFA'].map((hex) => (
                    <TouchableOpacity
                      key={hex}
                      onPress={() => this.setState({ cardColorTagInput: hex })}
                      style={[
                        this.styles.colorPickerDot,
                        { backgroundColor: hex },
                        this.state.cardColorTagInput === hex && this.styles.colorPickerDotActive,
                      ]}
                    />
                  ))}
                </View>

                <View style={this.styles.modalBtnRow}>
                  <TouchableOpacity
                    onPress={() => this.setState({ showAddCardModal: false, showEditCardModal: false, editingCardId: null })}
                    style={this.styles.cancelBtn}
                  >
                    <Text style={[this.styles.cancelBtnText, { color: palette.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.state.showEditCardModal ? this.handleUpdateCard : this.handleAddCard}
                    style={[this.styles.submitBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.submitBtnText, { color: palette.accentContrast }]}>
                      {this.state.showEditCardModal ? 'Save Card' : 'Add Card'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }
}

export class SecondBrainHubViewStyles {
  public static readonly styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 4,
    } as ViewStyle,
    subTabRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap',
    } as ViewStyle,
    subTabPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    } as ViewStyle,
    subTabPillText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    searchInput: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 12,
    } as TextStyle,
    tabContentArea: {
      flex: 1,
    } as ViewStyle,
    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    listHeading: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
    } as TextStyle,
    actionPill: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    } as ViewStyle,
    actionPillText: {
      color: '#0B0B0E',
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    actionPillOutline: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    } as ViewStyle,
    actionPillOutlineText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    cardItem: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginBottom: 10,
    } as ViewStyle,
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    } as ViewStyle,
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      flex: 1,
    } as TextStyle,
    statusPill: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginLeft: 8,
    } as ViewStyle,
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
    } as TextStyle,
    cardSubtitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    } as TextStyle,
    cardBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    } as ViewStyle,
    cardMeta: {
      fontSize: 12,
      marginTop: 2,
    } as TextStyle,
    cardActionIconBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    } as ViewStyle,
    cardActionIconText: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    microIconBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    } as ViewStyle,
    microIconText: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    cardDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
      marginBottom: 6,
    } as TextStyle,
    urlLinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    } as ViewStyle,
    domainChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    } as ViewStyle,
    domainChipText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    urlLinkText: {
      fontSize: 13,
      fontWeight: '600',
      textDecorationLine: 'underline',
    } as TextStyle,
    detailTopBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      flexWrap: 'wrap',
      gap: 8,
    } as ViewStyle,
    backBtn: {
      paddingVertical: 6,
    } as ViewStyle,
    backBtnText: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    bookHeroCard: {
      borderWidth: 1,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
    } as ViewStyle,
    bookTitleLarge: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    } as TextStyle,
    bookAuthorLarge: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 10,
    } as TextStyle,
    bookDatePill: {
      marginTop: 4,
    } as ViewStyle,
    bookDateText: {
      fontSize: 13,
      fontWeight: '500',
    } as TextStyle,
    sectionSubhead: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 6,
    } as TextStyle,
    bookBlockCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
    } as ViewStyle,
    blockHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    } as ViewStyle,
    blockBadge: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    } as TextStyle,
    chapterTag: {
      fontSize: 11,
      fontWeight: '600',
    } as TextStyle,
    blockBodyText: {
      fontSize: 15,
      lineHeight: 22,
    } as TextStyle,
    dateNavCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 20,
      padding: 12,
      marginBottom: 12,
    } as ViewStyle,
    dateNavArrow: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    } as ViewStyle,
    dateNavArrowText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    dateNavCenter: {
      alignItems: 'center',
    } as ViewStyle,
    dateNavTitle: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    todayBadge: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    } as TextStyle,
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 12,
      marginBottom: 16,
    } as ViewStyle,
    statBox: {
      alignItems: 'center',
    } as ViewStyle,
    statValue: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 2,
    } as TextStyle,
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    } as TextStyle,
    routineManagerDrawer: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    } as ViewStyle,
    routineManageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    } as ViewStyle,
    routineManageTitle: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    emptyCard: {
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    emptyCardText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    } as TextStyle,
    taskItemCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: 1,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
    } as ViewStyle,
    taskCheck: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      marginRight: 12,
      marginTop: 2,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    taskCheckMark: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '800',
    } as TextStyle,
    taskBody: {
      flex: 1,
    } as ViewStyle,
    taskTitleText: {
      fontSize: 15,
      fontWeight: '600',
    } as TextStyle,
    taskNoteText: {
      fontSize: 13,
      marginTop: 3,
      lineHeight: 18,
    } as TextStyle,
    taskDaysPill: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6,
    } as TextStyle,
    projectHeroCard: {
      borderWidth: 1,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
    } as ViewStyle,
    projectTitleLarge: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    } as TextStyle,
    projectDescLarge: {
      fontSize: 14,
      lineHeight: 20,
    } as TextStyle,
    projectStatusBadge: {
      marginTop: 8,
    } as ViewStyle,
    projectStatusBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    } as TextStyle,
    cardsGrid: {
      gap: 10,
    } as ViewStyle,
    brainstormCard: {
      borderWidth: 1.5,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
    } as ViewStyle,
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    } as ViewStyle,
    colorBadge: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    } as ViewStyle,
    brainstormTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    } as TextStyle,
    brainstormContent: {
      fontSize: 14,
      lineHeight: 20,
    } as TextStyle,
    colorPickerDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
    } as ViewStyle,
    colorPickerDotActive: {
      borderWidth: 2.5,
      borderColor: '#FFFFFF',
    } as ViewStyle,
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      padding: 20,
    } as ViewStyle,
    modalSheet: {
      borderWidth: 1,
      borderRadius: 24,
      padding: 20,
      maxHeight: '88%',
    } as ViewStyle,
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 6,
    } as TextStyle,
    modalSubtitle: {
      fontSize: 13,
      marginBottom: 14,
      lineHeight: 18,
    } as TextStyle,
    modalInput: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 14,
      marginBottom: 10,
    } as TextStyle,
    modalTextArea: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 96,
      fontSize: 14,
      marginBottom: 12,
      textAlignVertical: 'top',
    } as TextStyle,
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    } as ViewStyle,
    checkboxSmall: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      marginRight: 8,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    checkmarkSmall: {
      color: '#0B0B0E',
      fontSize: 11,
      fontWeight: '800',
    } as TextStyle,
    toggleLabel: {
      fontSize: 14,
      fontWeight: '500',
    } as TextStyle,
    typeSelectorRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    } as ViewStyle,
    typePill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
    } as ViewStyle,
    daysSelectorLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginTop: 4,
      marginBottom: 8,
    } as TextStyle,
    daysButtonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    } as ViewStyle,
    dayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    dayCircleText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    modalBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
    } as ViewStyle,
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
    } as ViewStyle,
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    submitBtn: {
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
    } as ViewStyle,
    submitBtnText: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
  });
}
