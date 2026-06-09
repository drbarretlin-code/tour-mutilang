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
}

interface DebtTransfer {
  from: string;
  to: string;
  amount: number;
}

export function ExpenseSplitter({ itinerary, survey }: ExpenseSplitterProps) {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [companions, setCompanions] = useState<string[]>([]);
  const [newCompanion, setNewCompanion] = useState('');
  
  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseSplitWith, setExpenseSplitWith] = useState<string[]>([]);

  // Currency converter states
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('0.90'); // 預設 1 THB = 0.90 TWD
  const [exchangeRateStatus, setExchangeRateStatus] = useState('預設匯率: 1 THB = 0.9 TWD');

  const EXPENSES_KEY = `@expenses_${itinerary.id}`;

  // 背景獲取即時泰銖對台幣匯率
  useEffect(() => {
    if (showAddExpense) {
      setIsForeignCurrency(false);
      setForeignAmount('');
      setExchangeRate('0.90');
      setExchangeRateStatus('正在載入最新匯率...');
      
      fetch('https://open.er-api.com/v6/latest/THB')
        .then(res => res.json())
        .then(data => {
          if (data && data.rates && data.rates.TWD) {
            const rate = data.rates.TWD;
            setExchangeRate(rate.toFixed(4));
            setExchangeRateStatus(`已獲取今日即時匯率: 1 THB = ${rate.toFixed(2)} TWD`);
          } else {
            setExchangeRate('0.90');
            setExchangeRateStatus('無台幣匯率資料，使用預設: 1 THB = 0.9 TWD');
          }
        })
        .catch(err => {
          console.warn('Failed to fetch live exchange rate, using default.', err);
          setExchangeRate('0.90');
          setExchangeRateStatus('離線/載入失敗，使用預設匯率: 1 THB = 0.9 TWD');
        });
    }
  }, [showAddExpense]);

  // 外幣金額與匯率改變時，自動換算台幣
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
      createdAt: new Date().toISOString()
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

  // Calculation Algorithm: Simplify Debts (Greedy Matching)
  const calculateSettlements = (): DebtTransfer[] => {
    const balances: Record<string, number> = {};
    companions.forEach(c => { balances[c] = 0; });

    // 1. Calculate net balance for each person
    expenses.forEach(exp => {
      const share = exp.amount / exp.splitWith.length;
      
      // Paid by gets positive cashflow credit
      if (balances[exp.paidBy] !== undefined) {
        balances[exp.paidBy] += exp.amount;
      }
      
      // Split members get negative cashflow debit
      exp.splitWith.forEach(member => {
        if (balances[member] !== undefined) {
          balances[member] -= share;
        }
      });
    });

    // 2. Separate creditors (receivers) and debtors (payers)
    const creditors: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];

    Object.keys(balances).forEach(name => {
      const bal = balances[name] || 0;
      // Round to 1 decimal place to prevent floating point inaccuracies
      const rounded = Math.round(bal * 10) / 10;
      if (rounded > 0.5) {
        creditors.push({ name, amount: rounded });
      } else if (rounded < -0.5) {
        debtors.push({ name, amount: Math.abs(rounded) });
      }
    });

    // Sort descending
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transfers: DebtTransfer[] = [];

    // 3. Greedy match debtors to creditors
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

  const settlements = calculateSettlements();
  const totalCost = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {/* Budget Summary Progress Card */}
      <Card variant="elevated" style={styles.summaryCard}>
        <Text style={[typography.titleMedium, { color: colors.text, fontWeight: '700' }]}>
          {t('itinerary.expenseSplitter.summary.title')}
        </Text>
        <Text style={[typography.headlineMedium, { color: colors.primary500, fontWeight: '800', marginVertical: spacing.xs }]}>
          {totalCost.toLocaleString()} {survey.currency}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {t('itinerary.expenseSplitter.summary.budgetLevel', { level: t(`survey.budget.${survey.budgetLevel}`) })}
        </Text>
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
      <Text style={[typography.titleMedium, { color: colors.text, marginVertical: spacing.sm, fontWeight: '600' }]}>
        {t('itinerary.expenseSplitter.settlement.title')}
      </Text>
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

            <Text style={[typography.titleSmall, { color: colors.text, fontWeight: '700', marginRight: spacing.md }]}>
              {exp.amount} {survey.currency}
            </Text>

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

              {/* 外幣換算切換 */}
              <TouchableOpacity
                onPress={() => setIsForeignCurrency(!isForeignCurrency)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.md,
                  marginBottom: spacing.xs
                }}
              >
                <Ionicons
                  name={isForeignCurrency ? "checkbox" : "square-outline"}
                  size={18}
                  color={isForeignCurrency ? colors.primary500 : colors.textTertiary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
                  輸入泰銖 (THB) 外幣金額換算台幣
                </Text>
              </TouchableOpacity>

              {isForeignCurrency && (
                <View style={{
                  padding: spacing.md,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: borderRadius.md,
                  marginBottom: spacing.xs
                }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8, fontWeight: '600' }]}>
                    {exchangeRateStatus}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    {/* 外幣金額 */}
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>泰銖金額 (฿)</Text>
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
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>自訂匯率 (THB to TWD)</Text>
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
                      💰 換算後金額：{expenseAmount} {survey.currency}
                    </Text>
                  )}
                </View>
              )}

              <Input
                label={t('itinerary.expenseSplitter.modal.fields.amountLabel', { currency: survey.currency })}
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
});
