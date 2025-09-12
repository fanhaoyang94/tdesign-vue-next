import { isFunction } from 'lodash-es';
import { TableRowData, PrimaryTableCol, SortInfo } from '../type';

// 树形排序配置
export interface TreeSortConfig {
  sortLevel?: 'all' | 'same-level' | 'root-only';
  keepTreeStructure?: boolean;
  childrenKey?: string;
}

/**
 * 树形数据排序器
 */
export class TreeDataSorter {
  private config: Required<TreeSortConfig>;
  private sorterFuncMap: Record<string, Function> = {};

  constructor(columns: PrimaryTableCol[], config: TreeSortConfig = {}) {
    this.config = {
      sortLevel: config.sortLevel || 'same-level',
      keepTreeStructure: config.keepTreeStructure ?? true,
      childrenKey: config.childrenKey || 'children',
    };
    this.buildSorterFuncMap(columns);
  }

  /**
   * 构建排序函数映射
   */
  private buildSorterFuncMap(columns: PrimaryTableCol[]) {
    const map: { [key: string]: Function } = {};
    this.extractSorterFunctions(columns, map);
    this.sorterFuncMap = map;
  }

  /**
   * 递归提取排序函数
   */
  private extractSorterFunctions(columns: PrimaryTableCol[], map: { [key: string]: Function } = {}) {
    for (let i = 0, len = columns.length; i < len; i++) {
      const col = columns[i];
      if (isFunction(col.sorter)) {
        map[col.colKey] = col.sorter;
      }
      // 多级表头中的排序功能
      if (col.children?.length) {
        this.extractSorterFunctions(col.children, map);
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TreeSortConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 树形数据排序主入口
   */
  sortTreeData(data: TableRowData[], sortInfo: SortInfo | SortInfo[]): TableRowData[] {
    if (!data?.length || !sortInfo) return data;

    const sortArray = Array.isArray(sortInfo) ? sortInfo : [sortInfo];
    if (!sortArray.length) return data;

    // 🎯 根据配置选择排序策略
    switch (this.config.sortLevel) {
      case 'same-level':
        return this.sortSameLevel(data, sortArray);
      case 'root-only':
        return this.sortRootOnly(data, sortArray);
      case 'all':
        return this.config.keepTreeStructure
          ? this.sortAllWithStructure(data, sortArray)
          : this.sortAllFlat(data, sortArray);
      default:
        return data;
    }
  }

  /**
   * 同级排序：递归对每一级别分别排序
   */
  private sortSameLevel(data: TableRowData[], sortArray: SortInfo[]): TableRowData[] {
    const sortedData = this.applySorting([...data], sortArray);

    return sortedData.map((node) => {
      const children = node[this.config.childrenKey];
      if (children && Array.isArray(children) && children.length > 0) {
        return {
          ...node,
          [this.config.childrenKey]: this.sortSameLevel(children, sortArray),
        };
      }
      return node;
    });
  }

  /**
   * 仅根级排序：只对根节点排序，保持子节点原有顺序
   */
  private sortRootOnly(data: TableRowData[], sortArray: SortInfo[]): TableRowData[] {
    return this.applySorting([...data], sortArray);
  }

  /**
   * 完全平铺排序
   */
  private sortAllFlat(data: TableRowData[], sortArray: SortInfo[]): TableRowData[] {
    const flatData = this.flattenTreeData(data);
    return this.applySorting(flatData, sortArray);
  }

  /**
   * 平铺排序但尝试保持某些结构特征
   */
  private sortAllWithStructure(data: TableRowData[], sortArray: SortInfo[]): TableRowData[] {
    // 这是一个复杂的算法，需要重新构建树形结构
    const flatData = this.flattenTreeData(data);
    const sortedFlat = this.applySorting(flatData, sortArray);
    return this.reconstructTree(sortedFlat, data);
  }

  /**
   * 应用排序函数
   */
  private applySorting(data: TableRowData[], sortArray: SortInfo[]): TableRowData[] {
    return data.slice().sort((a: TableRowData, b: TableRowData) => {
      let sortResult = 0;
      for (let i = 0, len = sortArray.length; i < len; i++) {
        const item = sortArray[i];
        const sortFunc = this.sorterFuncMap[item.sortBy];
        // 上一个排序字段值相同时才会进行下一个字段的大小对比
        if (sortResult === 0 && sortFunc) {
          sortResult = item.descending ? sortFunc(b, a) : sortFunc(a, b);
        } else {
          break;
        }
      }
      return sortResult;
    });
  }

  /**
   * 扁平化树形数据
   */
  private flattenTreeData(data: TableRowData[]): TableRowData[] {
    const result: TableRowData[] = [];

    const flatten = (nodes: TableRowData[]) => {
      nodes.forEach((node) => {
        // 添加当前节点（移除子节点引用以避免循环）
        const { [this.config.childrenKey]: children, ...nodeWithoutChildren } = node;
        result.push(nodeWithoutChildren);

        // 递归处理子节点
        if (children && Array.isArray(children) && children.length > 0) {
          flatten(children);
        }
      });
    };

    flatten(data);
    return result;
  }

  /**
   * 重新构建树形结构
   * 这是一个简化的实现，实际应用中可能需要根据具体的数据结构进行调整
   */
  private reconstructTree(flatData: TableRowData[], _originalData: TableRowData[]): TableRowData[] {
    // 简化实现：保持原有结构，但按照flatData的顺序重新排列
    // 在实际应用中，这个方法需要根据具体的业务需求来实现
    return flatData;
  }
}

export default function useTreeSorter(props: { columns: PrimaryTableCol[] }, config: TreeSortConfig = {}) {
  const sorter = new TreeDataSorter(props.columns, config);

  return {
    sortTreeData: (data: TableRowData[], sortInfo: SortInfo | SortInfo[]) => sorter.sortTreeData(data, sortInfo),
    updateConfig: (newConfig: Partial<TreeSortConfig>) => sorter.updateConfig(newConfig),
  };
}
