import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Itinerary } from '../../types/itinerary';
import { TripSurvey } from '../../types/survey';
import { t } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

interface ExpenseSplitterProps {
  itinerary: Itinerary;
  survey: TripSurvey;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string; // Name of the companion who paid
  splitWith: string[]; // Names of the companions sharing the expense
  createdAt: string;
  originalAmount?: number;
  originalCurrency?: string;
  category?: string;
}

interface DebtTransfer {
  from: string;
  to: string;
  amount: number;
}

export function ExpenseSplitter({ itinerary, survey }: ExpenseSplitterProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const baseCurrency = survey.currency || 'TWD';
  const SUPPORTED_CURRENCIES = ['TWD', 'THB', 'JPY', 'KRW', 'USD', 'EUR', 'CNY', 'HKD', 'SGD'];

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [companions, setCompanions] = useState<string[]>([]);
  const [newCompanion, setNewCompanion] = useState('');
  
  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('food');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseSplitWith, setExpenseSplitWith] = useState<string[]>([]);

  const CATEGORIES = [
    { id: 'food', label: '餐飲', color: '#F59E0B' },
    { id: 'transport', label: '交通', color: '#3B82F6' },
    { id: 'accommodation', label: '住宿', color: '#8B5CF6' },
    { id: 'shopping', label: '購物', color: '#EC4899' },
    { id: 'tickets', label: '門票', color: '#10B981' },
    { id: 'others', label: '其他', color: '#64748B' },
  ];

  // Currency converter states
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1.0000');
  const [exchangeRateStatus, setExchangeRateStatus] = useState('正在初始化匯率表...');

  const EXPENSES_KEY = `@expenses_${itinerary.id}`;
  const EXCHANGE_RATES_CACHE_KEY = `@exchange_rates_cache_${baseCurrency}`;

  // 背景獲取即時多國匯率並儲存快取
  useEffect(() => {
    async function loadRates() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`, { signal: controller.signal });
        clearTimeout(timer);
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            setExchangeRates(data.rates);
            await AsyncStorage.setItem(EXCHANGE_RATES_CACHE_KEY, JSON.stringify({
              rates: data.rates,
              timestamp: Date.now()
            }));
            setExchangeRateStatus(`已聯網更新即時匯率表 (以 ${baseCurrency} 為基準)`);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch live exchange rates:', e);
      }

      // 載入歷史快取
      try {
        const cached = await AsyncStorage.getItem(EXCHANGE_RATES_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setExchangeRates(parsed.rates);
          const dateStr = new Date(parsed.timestamp).toLocaleDateString();
          setExchangeRateStatus(`使用歷史快取匯率 (更新於 ${dateStr})`);
          return;
        }
      } catch {}

      // 備援基礎匯率表 (當離線且無快取時)
      const defaults: Record<string, Record<string, number>> = {
        TWD: { TWD: 1, THB: 1.08, JPY: 4.8, KRW: 42.5, USD: 0.0308, EUR: 0.0286, CNY: 0.22, HKD: 0.24, SGD: 0.042 },
        THB: { THB: 1, TWD: 0.92, JPY: 4.4, KRW: 39.0, USD: 0.028, EUR: 0.026, CNY: 0.20, HKD: 0.22, SGD: 0.038 },
        USD: { USD: 1, TWD: 32.5, THB: 35.8, JPY: 155.0, KRW: 1370.0, EUR: 0.92, CNY: 7.25, HKD: 7.8, SGD: 1.35 }
      };

      const baseDefaults = defaults[baseCurrency] || { [baseCurrency]: 1 };
      const rateMap: Record<string, number> = { ...baseDefaults };
      SUPPORTED_CURRENCIES.forEach(cur => {
        if (rateMap[cur] === undefined) rateMap[cur] = 1;
      });
      setExchangeRates(rateMap);
      setExchangeRateStatus(`網路離線，已載入本機基準匯率表`);
    }

    loadRates();
  }, [baseCurrency]);

  // 外幣金額與匯率改變時，自動換算本位幣
  useEffect(() => {
    if (isForeignCurrency) {
      const famount = parseFloat(foreignAmount);
      const rate = parseFloat(exchangeRate);
      if (!isNaN(famount) && !isNaN(rate) && famount > 0 && rate > 0) {
        setExpenseAmount(Math.round(famount * rate).toString());
      } else {
        setExpenseAmount('');
      }
    }
  }, [foreignAmount, exchangeRate, isForeignCurrency]);
  const COMPANIONS_KEY = `@companions_${itinerary.id}`;

  // Initialize companions and expenses
  useEffect(() => {
    async function loadData() {
      try {
        const cachedCompanions = await AsyncStorage.getItem(COMPANIONS_KEY);
        const cachedExpenses = await AsyncStorage.getItem(EXPENSES_KEY);

        if (cachedCompanions) {
          setCompanions(JSON.parse(cachedCompanions) as string[]);
        } else {
          // Prepopulate based on survey traveler counts
          const initialCompanions = [t('itinerary.expenseSplitter.me')];
          const adultCount = survey.travelers.adults;
          for (let i = 1; i < adultCount; i++) {
            initialCompanions.push(t('itinerary.expenseSplitter.companionN', { n: i }));
          }
          setCompanions(initialCompanions);
          await AsyncStorage.setItem(COMPANIONS_KEY, JSON.stringify(initialCompanions));
        }

        if (cachedExpenses) {
          setExpenses(JSON.parse(cachedExpenses) as Expense[]);
        }
      } catch (error) {
        console.error('Error loading expenses splitter data:', error);
      }
    }
    loadData();
  }, [itinerary.id]);

  const saveExpenses = async (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    try {
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(newExpenses));
    } catch (e) {
      console.error(e);
    }
  };

  const saveCompanions = async (newComps: string[]) => {
    setCompanions(newComps);
    try {
      await AsyncStorage.setItem(COMPANIONS_KEY, JSON.stringify(newComps));
    } catch (e) {
      console.error(e);
    }
  };

  // Add a new traveler companion
  const handleAddCompanion = () => {
    if (!newCompanion.trim()) return;
    if (companions.includes(newCompanion.trim())) {
      Alert.alert(t('common.error'), t('itinerary.expenseSplitter.errors.companionExists'));
      return;
    }
    const updated = [...companions, newCompanion.trim()];
    saveCompanions(updated);
    setNewCompanion('');
  };

  // Remove a companion
  const handleRemoveCompanion = (name: string) => {
    if (name === t('itinerary.expenseSplitter.me') || name === '我' || name === 'Me') {
      Alert.alert(t('common.error'), t('itinerary.expenseSplitter.errors.cannotRemoveCreator'));
      return;
    }
    const updated = companions.filter(c => c !== name);
    saveCompanions(updated);
    // Also remove from expenses splits
    const updatedExpenses = expenses.map(exp => ({
      ...exp,
      splitWith: exp.splitWith.filter(s => s !== name),
      paidBy: exp.paidBy === name ? t('itinerary.expenseSplitter.me') : exp.paidBy
    }));
    saveExpenses(updatedExpenses);
  };

  // Open modal prefilled
  const openExpenseModal = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('food');
    setSelectedCurrency(baseCurrency);
    setIsForeignCurrency(false);
    setForeignAmount('');
    setExpensePaidBy(companions[0] || t('itinerary.expenseSplitter.me'));
    setExpenseSplitWith([...companions]);
    setShowAddExpense(true);
  };

  // Toggle selection in multi-select checklist
  const toggleSplitMember = (name: string) => {
    if (expenseSplitWith.includes(name)) {
      if (expenseSplitWith.length === 1) return; // Keep at least one
      setExpenseSplitWith(expenseSplitWith.filter(item => item !== name));
    } else {
      setExpenseSplitWith([...expenseSplitWith, name]);
    }
  };

  // Submit expense record
  const handleAddExpense = () => {
    const amountNum = parseFloat(expenseAmount);
    if (!expenseTitle.trim()) {
      Alert.alert(t('common.error'), t('itinerary.expenseSplitter.errors.emptyTitle'));
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t('common.error'), t('itinerary.expenseSplitter.errors.invalidAmount'));
      return;
    }
    if (expenseSplitWith.length === 0) {
      Alert.alert(t('common.error'), t('itinerary.expenseSplitter.errors.noSplitters'));
      return;
    }

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      title: expenseTitle.trim(),
      amount: amountNum,
      paidBy: expensePaidBy,
      splitWith: expenseSplitWith,
      createdAt: new Date().toISOString(),
      category: expenseCategory,
      originalAmount: selectedCurrency !== baseCurrency ? parseFloat(foreignAmount) : undefined,
      originalCurrency: selectedCurrency !== baseCurrency ? selectedCurrency : undefined
    };

    const updated = [newExp, ...expenses];
    saveExpenses(updated);
    setShowAddExpense(false);
  };

  // Delete an expense record
  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    saveExpenses(updated);
  };

  // 原始未簡化的交易計算邏輯
  const calculateRawTransactions = (): DebtTransfer[] => {
    const rawMatrix: Record<string, Record<string, number>> = {};
    companions.forEach(c1 => {
      rawMatrix[c1] = {};
      companions.forEach(c2 => {
        rawMatrix[c1][c2] = 0;
      });
    });

    expenses.forEach(exp => {
      const share = exp.amount / exp.splitWith.length;
      exp.splitWith.forEach(member => {
        if (member !== exp.paidBy) {
          rawMatrix[member][exp.paidBy] += share;
        }
      });
    });

    const rawTransfers: DebtTransfer[] = [];
    for (let i = 0; i < companions.length; i++) {
      for (let j = i + 1; j < companions.length; j++) {
        const c1 = companions[i];
        const c2 = companions[j];
        const c1OwesC2 = rawMatrix[c1][c2] || 0;
        const c2OwesC1 = rawMatrix[c2][c1] || 0;

        if (c1OwesC2 > c2OwesC1) {
          const net = c1OwesC2 - c2OwesC1;
          if (net > 0.5) {
            rawTransfers.push({ from: c1, to: c2, amount: Math.round(net) });
          }
        } else if (c2OwesC1 > c1OwesC2) {
          const net = c2OwesC1 - c1OwesC2;
          if (net > 0.5) {
            rawTransfers.push({ from: c2, to: c1, amount: Math.round(net) });
          }
        }
      }
    }
    return rawTransfers;
  };

  // 債務簡化最少交易匹配算法
  const calculateSettlements = (): DebtTransfer[] => {
    const balances: Record<string, number> = {};
    companions.forEach(c => { balances[c] = 0; });

    // 1. 計算每個人的淨餘額
    expenses.forEach(exp => {
      const share = exp.amount / exp.splitWith.length;
      if (balances[exp.paidBy] !== undefined) {
        balances[exp.paidBy] += exp.amount;
      }
      exp.splitWith.forEach(member => {
        if (balances[member] !== undefined) {
          balances[member] -= share;
        }
      });
    });

    // 2. 區分債權人與債務人
    let creditors: { name: string; amount: number }[] = [];
    let debtors: { name: string; amount: number }[] = [];

    Object.keys(balances).forEach(name => {
      const bal = balances[name] || 0;
      const rounded = Math.round(bal * 10) / 10;
      if (rounded > 0.5) {
        creditors.push({ name, amount: rounded });
      } else if (rounded < -0.5) {
        debtors.push({ name, amount: Math.abs(rounded) });
      }
    });

    const transfers: DebtTransfer[] = [];

    // 3. 精準抵銷優化：若有債務人與債權人金額正好相等，優先對齊消除，減少交易次數
    for (let d = 0; d < debtors.length; d++) {
      const debtor = debtors[d];
      if (debtor.amount < 0.5) continue;
      
      const matchIndex = creditors.findIndex(c => Math.abs(c.amount - debtor.amount) < 0.5);
      if (matchIndex !== -1) {
        const creditor = creditors[matchIndex];
        transfers.push({
          from: debtor.name,
          to: creditor.name,
          amount: Math.round(debtor.amount)
        });
        debtor.amount = 0;
        creditor.amount = 0;
      }
    }

    debtors = debtors.filter(d => d.amount >= 0.5);
    creditors = creditors.filter(c => c.amount >= 0.5);

    // 排序
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // 4. 貪婪演算法匹配剩餘債務
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]!;
      const creditor = creditors[j]!;

      const amountToTransfer = Math.min(debtor.amount, creditor.amount);
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(amountToTransfer)
      });

      debtor.amount -= amountToTransfer;
      creditor.amount -= amountToTransfer;

      if (debtor.amount < 0.5) i++;
      if (creditor.amount < 0.5) j++;
    }

    return transfers;
  };

  const rawTransfers = calculateRawTransactions();
  const settlements = calculateSettlements();
  const totalCost = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const rawCount = rawTransfers.length;
  const simplifiedCount = settlements.length;
  const savedCount = rawCount - simplifiedCount;

  // Pie Chart calculations
  const categoryTotals = CATEGORIES.map(c => {
    const total = expenses.filter(e => (e.category || 'others') === c.id).reduce((sum, e) => sum + e.amount, 0);
    return { ...c, total };
  }).filter(c => c.total > 0);

  const radius = 60;
  const strokeWidth = 20;
  const center = radius + strokeWidth;
  const circumference = 2 * Math.PI * radius;
  let strokeDashoffset = 0;

  // Budget calculations
  const TWD_BUDGETS = { economy: 1500, moderate: 3000, luxury: 8000 };
  const dailyBudgetTWD = TWD_BUDGETS[survey.budgetLevel as keyof typeof TWD_BUDGETS] || 3000;
  const twdRate = exchangeRates['TWD'] || 1;
  const dailyBudgetLocal = dailyBudgetTWD / twdRate;
  const daysCount = itinerary.days.length || 1;
  const totalBudgetLimit = Math.round(dailyBudgetLocal * daysCount);
  const budgetPercentage = Math.min((totalCost / totalBudgetLimit) * 100, 100);
  const isOverBudget = totalCost > totalBudgetLimit;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {/* Budget Summary Progress Card */}
      <Card variant="elevated" style={styles.summaryCard}>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
          {t('itinerary.expenseSplitter.summary.title')}
        </Text>
        <Text style={[typography.headlineMedium, { color: isOverBudget ? colors.error500 : colors.primary500, fontWeight: '800', marginVertical: spacing.xs }]}>
          {totalCost.toLocaleString()} {survey.currency}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          預算等級: {t(`survey.budget.${survey.budgetLevel}`)} / 總預算上限: {totalBudgetLimit.toLocaleString()} {survey.currency}
        </Text>
        
        {/* Budget Progress Bar */}
        <View style={styles.budgetBarContainer}>
          <View style={[styles.budgetBarFill, { width: `${budgetPercentage}%`, backgroundColor: isOverBudget ? colors.error500 : colors.primary500 }]} />
        </View>
        <Text style={[typography.caption, { color: isOverBudget ? colors.error500 : colors.textSecondary, marginTop: 4, alignSelf: 'flex-end' }]}>
          {isOverBudget ? `超支 ${(totalCost - totalBudgetLimit).toLocaleString()} ${survey.currency}` : `剩餘 ${(totalBudgetLimit - totalCost).toLocaleString()} ${survey.currency}`}
        </Text>

        {/* Ring Chart & Legend */}
        {categoryTotals.length > 0 && (
          <View style={styles.chartContainer}>
            <View style={styles.chartWrapper}>
              <Svg width={center * 2} height={center * 2}>
                <G rotation="-90" origin={`${center}, ${center}`}>
                  {categoryTotals.map((cat, index) => {
                    const percentage = cat.total / totalCost;
                    const strokeDasharray = `${circumference * percentage} ${circumference}`;
                    const currentOffset = strokeDashoffset;
                    strokeDashoffset -= circumference * percentage;
                    return (
                      <Circle
                        key={cat.id}
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={cat.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={currentOffset}
                        fill="transparent"
                      />
                    );
                  })}
                </G>
              </Svg>
            </View>
            <View style={styles.legendContainer}>
              {categoryTotals.map(cat => (
                <View key={cat.id} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: cat.color }]} />
                  <Text style={[typography.caption, { color: colors.text, flex: 1 }]}>{cat.label}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                    {Math.round((cat.total / totalCost) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Companions Management */}
      <Card variant="flat" style={styles.companionsCard}>
        <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '700', marginBottom: spacing.xs }]}>
          {t('itinerary.expenseSplitter.companions.title', { count: companions.length })}
        </Text>
        
        {/* Companions Badge list */}
        <View style={styles.companionList}>
          {companions.map(name => (
            <View key={name} style={[styles.companionBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[typography.bodySmall, { color: colors.text }]}>{name}</Text>
              {(name !== t('itinerary.expenseSplitter.me') && name !== '我' && name !== 'Me') && (
                <TouchableOpacity onPress={() => handleRemoveCompanion(name)} style={{ marginLeft: 6 }}>
                  <Ionicons name="close-circle" size={14} color={colors.error500} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Add traveler row */}
        <View style={styles.addCompanionRow}>
          <TextInput
            style={[
              styles.textInput,
              typography.bodyMedium,
              {
                borderColor: colors.border,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.background,
                color: colors.text,
                paddingHorizontal: spacing.sm,
                height: 36,
              }
            ]}
            placeholder={t('itinerary.expenseSplitter.companions.addPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={newCompanion}
            onChangeText={setNewCompanion}
          />
          <TouchableOpacity
            onPress={handleAddCompanion}
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.primary500,
                borderRadius: borderRadius.sm,
                marginLeft: spacing.sm,
                height: 36,
                paddingHorizontal: spacing.md
              }
            ]}
          >
            <Text style={[typography.labelSmall, { color: colors.neutral0, fontWeight: '700' }]}>
              {t('itinerary.expenseSplitter.companions.addBtn')}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Debt settlement recommendations */}
      <View style={[styles.flexRow, { marginVertical: spacing.sm, justifyContent: 'space-between' }]}>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
          {t('itinerary.expenseSplitter.settlement.title')}
        </Text>
        {savedCount > 0 && (
          <View style={[styles.savingBadge, { backgroundColor: colors.success100, borderColor: colors.success300 }]}>
            <Ionicons name="flash" size={12} color={colors.success700} style={{ marginRight: 2 }} />
            <Text style={[typography.caption, { color: colors.success700, fontWeight: '800', fontSize: 10 }]}>
              {`已簡化 (由 ${rawCount} 筆降為 ${simplifiedCount} 筆)`}
            </Text>
          </View>
        )}
      </View>
      <Card variant="elevated" style={styles.settlementCard}>
        {settlements.length === 0 ? (
          <View style={styles.emptySettlement}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success500} />
            <Text style={[typography.bodyMedium, { color: colors.success500, marginLeft: spacing.xs, fontWeight: '600' }]}>
              {t('itinerary.expenseSplitter.settlement.allSettled')}
            </Text>
          </View>
        ) : (
          settlements.map((set, index) => (
            <View key={index} style={[styles.settlementRow, { borderBottomColor: colors.divider, borderBottomWidth: index < settlements.length - 1 ? 1 : 0 }]}>
              <View style={styles.transferGroup}>
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>{set.from}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary500} style={{ marginHorizontal: spacing.sm }} />
                <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>{set.to}</Text>
              </View>
              <Text style={[typography.titleSmall, { color: colors.primary500, fontWeight: '700', marginLeft: 'auto' }]}>
                {set.amount} {survey.currency}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Cost History list */}
      <View style={[styles.flexRow, { marginVertical: spacing.sm, justifyContent: 'space-between' }]}>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '600' }]}>
          {t('itinerary.expenseSplitter.expenses.title', { count: expenses.length })}
        </Text>
        <TouchableOpacity onPress={openExpenseModal} style={[styles.addExpHeaderBtn, { borderColor: colors.primary500 }]}>
          <Ionicons name="add" size={16} color={colors.primary500} style={{ marginRight: 2 }} />
          <Text style={[typography.labelSmall, { color: colors.primary500, fontWeight: '700' }]}>
            {t('itinerary.expenseSplitter.expenses.addBtn')}
          </Text>
        </TouchableOpacity>
      </View>

      {expenses.map((exp) => (
        <Card key={exp.id} style={{ marginBottom: spacing.xs }} variant="flat">
          <View style={styles.expItem}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                {exp.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('itinerary.expenseSplitter.expenses.detail', { paidBy: exp.paidBy, count: exp.splitWith.length })}
              </Text>
            </View>

            <View style={{ marginRight: spacing.md, alignItems: 'flex-end' }}>
              <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '700' }]}>
                {exp.amount} {survey.currency}
              </Text>
              {exp.originalAmount && exp.originalCurrency && (
                <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 10 }]}>
                  ({exp.originalAmount.toLocaleString()} {exp.originalCurrency})
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={() => handleDeleteExpense(exp.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.error500} />
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      {/* MODAL: Add Expense form */}
      <Modal visible={showAddExpense} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[typography.titleLarge, { color: colors.text, fontWeight: '700' }]}>{t('itinerary.expenseSplitter.modal.title')}</Text>
              <TouchableOpacity onPress={() => setShowAddExpense(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: spacing.md, maxHeight: 400 }}>
              <Input
                label={t('itinerary.expenseSplitter.modal.fields.titleLabel')}
                placeholder={t('itinerary.expenseSplitter.modal.fields.titlePlaceholder')}
                value={expenseTitle}
                onChangeText={setExpenseTitle}
              />

              {/* 分類選擇 */}
              <Text style={[typography.titleSmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '600' }]}>
                分類
              </Text>
              <View style={styles.pickerRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setExpenseCategory(cat.id)}
                    style={[
                      styles.pickerBtn,
                      {
                        backgroundColor: expenseCategory === cat.id ? cat.color : colors.backgroundSecondary,
                        borderColor: expenseCategory === cat.id ? 'transparent' : colors.border,
                        borderRadius: borderRadius.sm
                      }
                    ]}
                  >
                    <Text style={{ color: expenseCategory === cat.id ? '#FFFFFF' : colors.text, fontSize: 12, fontWeight: '600' }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 貨幣選擇 */}
              <Text style={[typography.titleSmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '600' }]}>
                選擇交易貨幣
              </Text>
              <View style={styles.pickerRow}>
                {SUPPORTED_CURRENCIES.map(cur => (
                  <TouchableOpacity
                    key={cur}
                    onPress={() => {
                      setSelectedCurrency(cur);
                      if (cur === baseCurrency) {
                        setIsForeignCurrency(false);
                      } else {
                        setIsForeignCurrency(true);
                        const defaultMultiplier = 1 / (exchangeRates[cur] || 1);
                        setExchangeRate(defaultMultiplier.toFixed(4));
                      }
                    }}
                    style={[
                      styles.pickerBtn,
                      {
                        backgroundColor: selectedCurrency === cur ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: selectedCurrency === cur ? 'transparent' : colors.border,
                        borderRadius: borderRadius.sm
                      }
                    ]}
                  >
                    <Text style={{ color: selectedCurrency === cur ? colors.neutral0 : colors.text, fontSize: 12, fontWeight: '600' }}>
                      {cur}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isForeignCurrency && (
                <View style={{
                  padding: spacing.md,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: borderRadius.md,
                  marginBottom: spacing.xs,
                  marginTop: spacing.xs
                }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8, fontWeight: '600' }]}>
                    {exchangeRateStatus}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    {/* 外幣金額 */}
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>外幣金額 ({selectedCurrency})</Text>
                      <TextInput
                        style={{
                          height: 40,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderRadius: borderRadius.sm,
                          paddingHorizontal: 12,
                          fontSize: 14
                        }}
                        placeholder="例如: 1500"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        value={foreignAmount}
                        onChangeText={setForeignAmount}
                      />
                    </View>
                    {/* 自訂匯率 */}
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>自訂匯率 (1 {selectedCurrency} = ? {baseCurrency})</Text>
                      <TextInput
                        style={{
                          height: 40,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderRadius: borderRadius.sm,
                          paddingHorizontal: 12,
                          fontSize: 14
                        }}
                        placeholder="匯率"
                        keyboardType="numeric"
                        value={exchangeRate}
                        onChangeText={setExchangeRate}
                      />
                    </View>
                  </View>
                  {expenseAmount !== '' && (
                    <Text style={[typography.caption, { color: colors.primary500, fontWeight: '800' }]}>
                      💰 換算後金額：{expenseAmount} {baseCurrency}
                    </Text>
                  )}
                </View>
              )}

              <Input
                label={t('itinerary.expenseSplitter.modal.fields.amountLabel', { currency: baseCurrency })}
                placeholder={t('itinerary.expenseSplitter.modal.fields.amountPlaceholder')}
                keyboardType="numeric"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                editable={!isForeignCurrency} // 外幣換算時唯讀
                containerStyle={{ marginTop: spacing.md }}
              />

              {/* Paid by selection */}
              <Text style={[typography.titleSmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '600' }]}>
                {t('itinerary.expenseSplitter.modal.fields.paidByLabel')}
              </Text>
              <View style={styles.pickerRow}>
                {companions.map(name => (
                  <TouchableOpacity
                    key={name}
                    onPress={() => setExpensePaidBy(name)}
                    style={[
                      styles.pickerBtn,
                      {
                        backgroundColor: expensePaidBy === name ? colors.primary500 : colors.backgroundSecondary,
                        borderColor: expensePaidBy === name ? 'transparent' : colors.border,
                        borderRadius: borderRadius.sm
                      }
                    ]}
                  >
                    <Text style={{ color: expensePaidBy === name ? colors.neutral0 : colors.text, fontSize: 12 }}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Split with checklist */}
              <Text style={[typography.titleSmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '600' }]}>
                {t('itinerary.expenseSplitter.modal.fields.splitWithLabel')}
              </Text>
              {companions.map(name => {
                const isChecked = expenseSplitWith.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => toggleSplitMember(name)}
                    style={styles.splitSelectRow}
                  >
                    <Ionicons
                      name={isChecked ? "checkbox" : "square-outline"}
                      size={20}
                      color={isChecked ? colors.primary500 : colors.textTertiary}
                    />
                    <Text style={[typography.bodyMedium, { color: colors.text, marginLeft: spacing.sm }]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <Button
                title={t('common.confirm')}
                onPress={handleAddExpense}
                style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 12,
  },
  companionsCard: {
    padding: 12,
    marginBottom: 16,
  },
  companionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  companionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  addCompanionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    height: 36,
    width: '100%',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
  },
  addBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementCard: {
    padding: 12,
    marginBottom: 16,
  },
  emptySettlement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transferGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addExpHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  expItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  pickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  splitSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 12,
  },
  budgetBarContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    flex: 1,
    marginLeft: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
});
