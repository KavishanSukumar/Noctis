import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Dimensions,
  ScaledSize,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { KnowledgeGraphLink } from '../models/NoctisModels';
import { NoctisTheme, ResponsiveMetrics } from '../theme/NoctisTheme';

export class KnowledgeGraphViewProps {
  public nodes: Array<{ id: string; label: string; type: 'note' | 'diary' | 'book' | 'project'; category?: string }> = [];
  public links: KnowledgeGraphLink[] = [];
  public isDark: boolean = true;
  public onNodeSelect: (id: string, type: 'note' | 'diary' | 'book' | 'project') => void = () => {};
}

export class KnowledgeGraphViewState {
  public selectedNodeId: string | null = null;
  public windowWidth: number = Dimensions.get('window').width;
  public windowHeight: number = Dimensions.get('window').height;
}

export class KnowledgeGraphView extends React.Component<
  KnowledgeGraphViewProps,
  KnowledgeGraphViewState
> {
  private styles = KnowledgeGraphViewStyles.styles;
  private dimensionsSub: { remove: () => void } | null = null;

  constructor(props: KnowledgeGraphViewProps) {
    super(props);
    const win = Dimensions.get('window');
    this.state = {
      selectedNodeId: null,
      windowWidth: win.width,
      windowHeight: win.height,
    };
  }

  public override componentDidMount(): void {
    this.dimensionsSub = Dimensions.addEventListener('change', this.handleDimensionChange);
  }

  public override componentWillUnmount(): void {
    if (this.dimensionsSub) {
      this.dimensionsSub.remove();
    }
  }

  private handleDimensionChange = ({ window }: { window: ScaledSize }): void => {
    this.setState({
      windowWidth: window.width,
      windowHeight: window.height,
    });
  };

  private handleNodePress = (id: string, type: 'note' | 'diary' | 'book' | 'project'): void => {
    Haptics.selectionAsync();
    this.setState({ selectedNodeId: id });
    this.props.onNodeSelect(id, type);
  };

  public override render() {
    const palette = NoctisTheme.getColors(this.props.isDark);
    const metrics: ResponsiveMetrics = NoctisTheme.getResponsiveMetrics(
      this.state.windowWidth,
      this.state.windowHeight
    );
    const { nodes, links } = this.props;

    const noteCount = nodes.filter((n) => n.type === 'note').length;
    const diaryCount = nodes.filter((n) => n.type === 'diary').length;

    // Compute dynamic width per column
    const gap = 12;
    const totalPadding = metrics.horizontalPadding * 2;
    const availableWidth = Math.min(this.state.windowWidth - totalPadding, metrics.maxContainerWidth - totalPadding);
    const columns = metrics.connectionColumns;
    const cardWidth = Math.floor((availableWidth - gap * (columns - 1)) / columns);

    return (
      <View style={[this.styles.container, { backgroundColor: palette.background, paddingHorizontal: metrics.horizontalPadding }]}>
        <View style={[this.styles.contentContainer, { maxWidth: metrics.maxContainerWidth, alignSelf: 'center', width: '100%' }]}>
          <View style={this.styles.header}>
            <Text style={[this.styles.title, { color: palette.textPrimary }]}>Connected Thoughts</Text>
            <Text style={[this.styles.subtitle, { color: palette.textSecondary }]}>
              {noteCount} Notes • {diaryCount} Journal Days • {links.length} Connections
            </Text>
          </View>

          <ScrollView contentContainerStyle={this.styles.clusterContainer} showsVerticalScrollIndicator={false}>
            {nodes.length === 0 ? (
              <View style={this.styles.emptyState}>
                <Text style={[this.styles.emptyIcon, { color: palette.textMuted }]}>🌌</Text>
                <Text style={[this.styles.emptyText, { color: palette.textSecondary }]}>
                  No linked thoughts yet. Mention another note using [[Note Title]] to connect them.
                </Text>
              </View>
            ) : (
              <View style={[this.styles.nodeGrid, { gap }]}>
                {nodes.map((node) => {
                  const isSelected = this.state.selectedNodeId === node.id;
                  const isDiary = node.type === 'diary';
                  const relatedLinks = links.filter(
                    (l) => l.sourceId === node.id || l.targetId === node.id
                  );

                  return (
                    <TouchableOpacity
                      key={node.id}
                      onPress={() => this.handleNodePress(node.id, node.type)}
                      style={[
                        this.styles.nodeCard,
                        {
                          width: cardWidth,
                          backgroundColor: isSelected
                            ? palette.accent
                            : isDiary
                            ? palette.glassElevated
                            : palette.cardBackground,
                          borderColor: isSelected ? palette.accent : palette.cardBorder,
                        },
                      ]}
                    >
                      <View style={this.styles.nodeBadgeRow}>
                        <Text
                          style={[
                            this.styles.nodeBadge,
                            {
                              color: isSelected
                                ? palette.accentContrast
                                : isDiary
                                ? palette.warning
                                : palette.accent,
                            },
                          ]}
                        >
                          {isDiary ? 'JOURNAL' : (node.category || 'NOTE').toUpperCase()}
                        </Text>
                        {relatedLinks.length > 0 && (
                          <Text
                            style={[
                              this.styles.nodeCount,
                              { color: isSelected ? palette.accentContrast : palette.textMuted },
                            ]}
                          >
                            🔗 {relatedLinks.length}
                          </Text>
                        )}
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          this.styles.nodeLabel,
                          {
                            color: isSelected ? palette.accentContrast : palette.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {node.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Links Summary list */}
            {links.length > 0 && (
              <View style={[this.styles.linksBox, { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder }]}>
                <Text style={[this.styles.linksBoxTitle, { color: palette.accent }]}>CONNECTIONS</Text>
                {links.slice(0, 10).map((link, idx) => {
                  const srcNode = nodes.find((n) => n.id === link.sourceId);
                  const tgtNode = nodes.find((n) => n.id === link.targetId);
                  return (
                    <Text key={idx} style={[this.styles.linkLine, { color: palette.textSecondary }]}>
                      <Text style={{ color: palette.textPrimary, fontWeight: '600' }}>
                        {srcNode?.label || link.sourceId}
                      </Text>{' '}
                      ⇄{' '}
                      <Text style={{ color: palette.textPrimary, fontWeight: '600' }}>
                        {tgtNode?.label || link.targetId}
                      </Text>
                    </Text>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }
}

export class KnowledgeGraphViewStyles {
  public static readonly styles = StyleSheet.create({
    container: {
      flex: 1,
    } as ViewStyle,
    contentContainer: {
      flex: 1,
    } as ViewStyle,
    header: {
      paddingVertical: 14,
    } as ViewStyle,
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
    } as TextStyle,
    subtitle: {
      fontSize: 13,
      marginTop: 4,
    } as TextStyle,
    clusterContainer: {
      paddingBottom: 40,
    } as ViewStyle,
    nodeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
    } as ViewStyle,
    nodeCard: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 14,
      minHeight: 84,
      justifyContent: 'space-between',
    } as ViewStyle,
    nodeBadgeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    } as ViewStyle,
    nodeBadge: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    } as TextStyle,
    nodeCount: {
      fontSize: 11,
      fontWeight: '600',
    } as TextStyle,
    nodeLabel: {
      fontSize: 14,
      lineHeight: 18,
    } as TextStyle,
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    } as ViewStyle,
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    } as TextStyle,
    emptyText: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 20,
    } as TextStyle,
    linksBox: {
      marginTop: 24,
      borderWidth: 1,
      borderRadius: 22,
      padding: 16,
    } as ViewStyle,
    linksBoxTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 10,
    } as TextStyle,
    linkLine: {
      fontSize: 13,
      lineHeight: 22,
      marginBottom: 4,
    } as TextStyle,
  });
}
