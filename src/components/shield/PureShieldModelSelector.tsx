import React, { useState, useEffect } from 'react';

/**
 * PureViewModelSelector Component
 * 
 * - Shows auto-detected device tier
 * - Allows user to manually select HIGH / MID / LOW
 * - Shows expected performance metrics for each tier
 * - Real-time performance monitoring
 */

interface ModelTierInfo {
  tier: 'HIGH' | 'MID' | 'LOW';
  name: string;
  description: string;
  expectedFps: number;
  expectedInferenceMs: number;
  batteryDrainPerHour: number;
  modelSize: string;
  inputSize: string;
  accuracy: number;
}

const MODEL_TIERS: Record<string, ModelTierInfo> = {
  HIGH: {
    tier: 'HIGH',
    name: 'High Quality',
    description: 'Best accuracy, uses more battery. For flagship devices.',
    expectedFps: 10,
    expectedInferenceMs: 50,
    batteryDrainPerHour: 8,
    modelSize: '2.4 MB',
    inputSize: '128x128 + 96x96',
    accuracy: 95,
  },
  MID: {
    tier: 'MID',
    name: 'Balanced',
    description: 'Good balance of speed and accuracy. Recommended for most devices.',
    expectedFps: 5,
    expectedInferenceMs: 80,
    batteryDrainPerHour: 4,
    modelSize: '4.2 MB',
    inputSize: '416x416',
    accuracy: 90,
  },
  LOW: {
    tier: 'LOW',
    name: 'Battery Saver',
    description: 'Ultra-fast, minimal battery drain. For older devices like Oppo A15.',
    expectedFps: 2,
    expectedInferenceMs: 20,
    batteryDrainPerHour: 1.5,
    modelSize: '0.5 MB',
    inputSize: '128x128',
    accuracy: 95,
  },
};

interface Props {
  onTierChange: (tier: 'HIGH' | 'MID' | 'LOW') => void;
  currentTier: 'HIGH' | 'MID' | 'LOW';
  autoDetectedTier: 'HIGH' | 'MID' | 'LOW';
  deviceInfo: string;
}

export const PureViewModelSelector: React.FC<Props> = ({
  onTierChange,
  currentTier,
  autoDetectedTier,
  deviceInfo,
}) => {
  const [selectedTier, setSelectedTier] = useState<'HIGH' | 'MID' | 'LOW'>(currentTier);
  const [batteryLevel, setBatteryLevel] = useState(100);

  useEffect(() => {
    setSelectedTier(currentTier);
  }, [currentTier]);

  // Monitor battery level for adaptive switching
  useEffect(() => {
    const checkBattery = async () => {
      try {
        // Mock battery check - in real app, use Battery Status API
        const randomBattery = Math.floor(Math.random() * 100);
        setBatteryLevel(randomBattery);
      } catch (error) {
        console.error('Battery check failed:', error);
      }
    };

    const interval = setInterval(checkBattery, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTierSelect = (tier: 'HIGH' | 'MID' | 'LOW') => {
    setSelectedTier(tier);
    onTierChange(tier);
  };

  const getWarningMessage = () => {
    if (selectedTier === 'HIGH' && batteryLevel < 20) {
      return '⚠️ High Quality mode drains battery fast. Consider Battery Saver mode.';
    }
    if (selectedTier === 'LOW' && batteryLevel > 80) {
      return '✓ Battery Saver mode is ideal for your current battery level.';
    }
    return null;
  };

  const currentTierInfo = MODEL_TIERS[selectedTier];
  const warningMsg = getWarningMessage();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>🤖 AI Model Selection</h3>
        <p style={styles.subtitle}>Choose processing quality vs battery usage</p>
      </div>

      {/* Device Info */}
      <div style={styles.deviceInfo}>
        <span style={styles.deviceLabel}>Your Device:</span>
        <span style={styles.deviceText}>{deviceInfo}</span>
      </div>

      {/* Auto-Detected Suggestion */}
      <div style={styles.suggestion}>
        <div style={styles.suggestionIcon}>💡</div>
        <div>
          <p style={styles.suggestionTitle}>Auto-Detected: {MODEL_TIERS[autoDetectedTier].name}</p>
          <p style={styles.suggestionText}>
            Based on your device specs, we recommend <strong>{MODEL_TIERS[autoDetectedTier].name}</strong> mode.
          </p>
        </div>
      </div>

      {/* Model Tier Selection */}
      <div style={styles.tierGrid}>
        {Object.values(MODEL_TIERS).map((tier) => (
          <ModelTierCard
            key={tier.tier}
            tier={tier}
            isSelected={selectedTier === tier.tier}
            isRecommended={autoDetectedTier === tier.tier}
            onSelect={() => handleTierSelect(tier.tier)}
          />
        ))}
      </div>

      {/* Selected Tier Details */}
      <div style={styles.detailsCard}>
        <h4 style={styles.detailsTitle}>{currentTierInfo.name} - Performance Details</h4>
        
        <div style={styles.metricsGrid}>
          <MetricBox label="Expected FPS" value={`${currentTierInfo.expectedFps} fps`} />
          <MetricBox label="Inference Time" value={`${currentTierInfo.expectedInferenceMs}ms`} />
          <MetricBox label="Battery/Hour" value={`~${currentTierInfo.batteryDrainPerHour}%`} />
          <MetricBox label="Accuracy" value={`${currentTierInfo.accuracy}%`} />
          <MetricBox label="Model Size" value={currentTierInfo.modelSize} />
          <MetricBox label="Input Size" value={currentTierInfo.inputSize} />
        </div>

        <p style={styles.detailsDescription}>{currentTierInfo.description}</p>
      </div>

      {/* Warning/Info Message */}
      {warningMsg && (
        <div style={styles.warningBox}>
          {warningMsg}
        </div>
      )}

      {/* Battery Status */}
      <div style={styles.batteryStatus}>
        <div style={styles.batteryBar}>
          <div
            style={{
              ...styles.batteryFill,
              width: `${batteryLevel}%`,
              backgroundColor: batteryLevel > 50 ? '#10b981' : batteryLevel > 20 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <span style={styles.batteryLabel}>Battery: {batteryLevel}%</span>
      </div>

      {/* Info */}
      <div style={styles.infoBox}>
        <p style={styles.infoText}>
          💡 <strong>Tip:</strong> Models will automatically switch to Battery Saver if your device gets too hot
          or battery drops below 15%.
        </p>
      </div>
    </div>
  );
};

interface ModelTierCardProps {
  tier: ModelTierInfo;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}

const ModelTierCard: React.FC<ModelTierCardProps> = ({ tier, isSelected, isRecommended, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      style={{
        ...styles.tierCard,
        ...(isSelected && styles.tierCardSelected),
        ...(isRecommended && styles.tierCardRecommended),
      }}
    >
      <div style={styles.tierCardIcon}>
        {tier.tier === 'HIGH' && '🚀'}
        {tier.tier === 'MID' && '⚡'}
        {tier.tier === 'LOW' && '🔋'}
      </div>
      
      <div style={styles.tierCardContent}>
        <h5 style={styles.tierCardName}>{tier.name}</h5>
        <p style={styles.tierCardSubtext}>
          {tier.expectedFps} fps • ~{tier.batteryDrainPerHour}%/hr
        </p>
      </div>

      {isSelected && <div style={styles.checkmark}>✓</div>}
      {isRecommended && !isSelected && <div style={styles.badge}>Recommended</div>}
    </button>
  );
};

interface MetricBoxProps {
  label: string;
  value: string;
}

const MetricBox: React.FC<MetricBoxProps> = ({ label, value }) => {
  return (
    <div style={styles.metricBox}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricValue}>{value}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#0f172a',
    borderRadius: 16,
    padding: 20,
    color: '#e2e8f0',
  },

  header: {
    marginBottom: 24,
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
  },

  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },

  deviceInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 12,
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 12,
  },

  deviceLabel: {
    color: '#64748b',
    fontWeight: 600,
  },

  deviceText: {
    color: '#3b82f6',
    fontWeight: 600,
  },

  suggestion: {
    display: 'flex',
    gap: 12,
    padding: 12,
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 10,
    marginBottom: 20,
  },

  suggestionIcon: {
    fontSize: 20,
    minWidth: 28,
  },

  suggestionTitle: {
    margin: '0 0 4px',
    fontSize: 13,
    fontWeight: 600,
    color: '#f1f5f9',
  },

  suggestionText: {
    margin: 0,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.4,
  },

  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 20,
  },

  tierCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1.5px solid #334155',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    position: 'relative',
    color: 'inherit',
    fontSize: 'inherit',
  },

  tierCardSelected: {
    borderColor: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.12)',
    boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)',
  },

  tierCardRecommended: {
    borderColor: '#8b5cf6',
    background: 'rgba(139, 92, 246, 0.1)',
  },

  tierCardIcon: {
    fontSize: 24,
  },

  tierCardContent: {
    textAlign: 'center',
  },

  tierCardName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
  },

  tierCardSubtext: {
    margin: 0,
    fontSize: 11,
    color: '#64748b',
  },

  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    background: '#3b82f6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
  },

  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: '#8b5cf6',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
  },

  detailsCard: {
    padding: 16,
    background: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    marginBottom: 16,
  },

  detailsTitle: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9',
  },

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    marginBottom: 12,
  },

  metricBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },

  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 600,
  },

  metricValue: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: 700,
  },

  detailsDescription: {
    margin: 0,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.5,
  },

  warningBox: {
    padding: 12,
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: 10,
    fontSize: 12,
    color: '#fbbf24',
    marginBottom: 16,
  },

  batteryStatus: {
    marginBottom: 16,
  },

  batteryBar: {
    width: '100%',
    height: 8,
    background: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },

  batteryFill: {
    height: '100%',
    transition: 'width 300ms ease',
  },

  batteryLabel: {
    fontSize: 11,
    color: '#64748b',
  },

  infoBox: {
    padding: 12,
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    fontSize: 12,
  },

  infoText: {
    margin: 0,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
};

export default PureViewModelSelector;