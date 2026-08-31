// Função auxiliar para formatar números como moeda para exibição
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

// Função para converter entrada de texto em valor decimal (máscara de centavos)
export const handlePriceMask = (rawValue) => {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';
  return (parseInt(digits, 10) / 100).toFixed(2);
};
